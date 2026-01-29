using Anthropic.SDK;
using Anthropic.SDK.Messaging;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
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

        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == request.UserId);
        if (wallet == null || wallet.Balance <= 0)
        {
            return BadRequest("Insufficient credits");
        }

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
                MaxTokens = 1024
            };

            // var response = await _anthropicClient.Messages.GetAsync(parameters);
            
            // TODO: Verify exact method name for Anthropic.SDK v4.3.1 (e.g. CreateAsync, GetAsync)
            // Mocking response to verify Token Accounting logic during scaffolding
            var response = new 
            { 
                Content = new [] { new { Text = "This is a mock response from the Intelligence Proxy." } }, 
                Usage = new { InputTokens = 15, OutputTokens = 40 } 
            };

            // 3. Token Accounting (Guardrail 1: Capture usage object directly)
            var inputTokens = response.Usage.InputTokens;
            var outputTokens = response.Usage.OutputTokens;
            var totalCost = (inputTokens + outputTokens) * MarkupRate;

            // 4. Transactional Update
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

            return Ok(new
            {
                Response = response.Content[0].Text,
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
}

public class ChatRequest
{
    public Guid UserId { get; set; }
    public string Prompt { get; set; } = string.Empty;
}
