using Microsoft.AspNetCore.Mvc;
using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("fixed")]
public class IntelligenceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly AnthropicClient _anthropicClient;
    private const decimal MarkupRate = 1.2m; // 20% markup

    public IntelligenceController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
        
        var apiKey = _configuration["Anthropic:ApiKey"];
        _anthropicClient = new AnthropicClient(apiKey);
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request)
    {
        // Guardrail 3: Identity-Aware Proxy (Shared Secret)
        var apiKeyHeader = Request.Headers["X-Worker-Secret"].ToString();
        var workerSecret = _configuration["Worker:SharedSecret"];
        
        if (string.IsNullOrEmpty(apiKeyHeader) || apiKeyHeader != workerSecret)
        {
            return Unauthorized("Invalid Worker Secret");
        }

        // 1. Validate User and Wallet
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId);
        if (user == null) return NotFound("User not found");
        
        // Guardrail 4: Trusted Source Check
        if (!string.IsNullOrEmpty(request.SourceId))
        {
            var hasDefinedSources = await _context.TrustedSources.AnyAsync(ts => ts.UserId == request.UserId);
            if (hasDefinedSources)
            {
                 var isTrusted = await _context.TrustedSources.AnyAsync(ts => ts.UserId == request.UserId && (ts.PhoneNumber == request.SourceId || ts.Email == request.SourceId));
                 if (!isTrusted)
                 {
                      _context.SecurityAuditLogs.Add(new SecurityAuditLog {
                          UserId = request.UserId,
                          Action = "Access",
                          Resource = "Intelligence API",
                          Status = "Blocked",
                          Reason = $"Untrusted Source: {request.SourceId}"
                      });
                      await _context.SaveChangesAsync();
                      return Unauthorized(new { Response = "⛔ ACCESS DENIED: This device is not a verified Trusted Source." });
                 }
            }
        }

        // 1.1 Fetch Session & Settings
        var session = await _context.WhatsAppSessions.FirstOrDefaultAsync(s => s.UserId == request.UserId);
        var settings = await _context.SecuritySettings.FindAsync(request.UserId);

        // Guardrail 5: HITL for Destructive Commands
        if (settings != null && settings.RequireApprovalForDestructive && session != null)
        {
             // Check for Pending Approval
             if (!string.IsNullOrEmpty(session.PendingCommand))
             {
                 if (request.Prompt.Trim().ToUpper() == "APPROVE")
                 {
                     // User Approved
                     _context.SecurityAuditLogs.Add(new SecurityAuditLog {
                         UserId = request.UserId,
                         Action = "Execution",
                         Resource = session.PendingCommand,
                         Status = "Allowed",
                         Reason = "User Approved via WhatsApp"
                     });
                     
                     // Restore the original command to be executed
                     request.Prompt = session.PendingCommand; 
                     session.PendingCommand = null;
                     await _context.SaveChangesAsync();
                     // Continue execution flow...
                 }
                 else
                 {
                     // User cancelled or ignored, clear pending
                      session.PendingCommand = null;
                      await _context.SaveChangesAsync();
                 }
             }
             // Check if NEW prompt is destructive (only if we didn't just approve one)
             else if (IsDestructive(request.Prompt))
             {
                  session.PendingCommand = request.Prompt;
                  session.PendingCommandTime = DateTime.UtcNow;
                  
                  _context.SecurityAuditLogs.Add(new SecurityAuditLog {
                         UserId = request.UserId,
                         Action = "Command Attempt",
                         Resource = request.Prompt,
                         Status = "Pending",
                         Reason = "Destructive command paused for approval"
                     });

                  await _context.SaveChangesAsync();
                  return Ok(new { Response = "🛡️ SECURITY INTERVENTION: You are attempting a destructive command. \n\nReply *APPROVE* to execute:\n" + request.Prompt });
             }
        }

        var bypassBilling = _configuration.GetValue<bool>("Anthropic:BypassBilling");
        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == request.UserId);
        
        if (!bypassBilling && (wallet == null || wallet.Balance <= 0))
        {
            return BadRequest("Insufficient credits");
        }

        var systemPrompt = session?.SystemPrompt ?? "You are Olubanise, a helpful AI personal assistant.";

        try
        {
            // 2. Call Claude 3.5
            var messages = new List<Message>
            {
                new Message(RoleType.User, request.Prompt)
            };

            var parameters = new MessageParameters
            {
                Messages = messages,
                Model = "claude-3-5-sonnet-20240620",
                MaxTokens = 1024,
                System = systemPrompt
            };

            var response = await _anthropicClient.Messages.GetClaudeMessageAsync(parameters);

            // 3. Token Accounting (Guardrail 1: Capture usage object directly)
            var inputTokens = response.Usage.InputTokens;
            var outputTokens = response.Usage.OutputTokens;
            var totalCost = (inputTokens + outputTokens) * MarkupRate;

            // 4. Transactional Update
            if (!bypassBilling && wallet != null)
            {
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    wallet.Balance -= totalCost;
                    wallet.UpdatedAt = DateTime.UtcNow;

                    var log = new TransactionLog
                    {
                        UserId = user.Id,
                        WalletId = wallet.Id,
                        Amount = -totalCost,
                        TransactionType = "DEBIT",
                        Description = $"Claude 3.5 - Prompt: {request.Prompt.Substring(0, Math.Min(request.Prompt.Length, 50))}..."
                    };

                    _context.TransactionLogs.Add(log);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }

            return Ok(new
            {
                Response = response.Message.ToString(),
                Usage = new
                {
                    InputTokens = inputTokens,
                    OutputTokens = outputTokens,
                    CostDeducted = totalCost
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Intelligence Proxy Error: {ex.Message}");
        }
    }

    private bool IsDestructive(string prompt)
    {
        var keywords = new[] { "delete", "remove", "format", "rm ", "erase", "wipe", "drop table" };
        return keywords.Any(k => prompt.ToLower().Contains(k));
    }
}

public class ChatRequest
{
    public Guid UserId { get; set; }
    public string Prompt { get; set; } = string.Empty;
    public string? SourceId { get; set; } // Phone number or Email
}
