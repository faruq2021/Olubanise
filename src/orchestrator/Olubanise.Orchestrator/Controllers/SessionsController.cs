using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;
using Olubanise.Orchestrator.Hubs;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHubContext<OlubaniseHub> _hubContext;

    public SessionsController(ApplicationDbContext context, IConfiguration configuration, IHubContext<OlubaniseHub> hubContext)
    {
        _context = context;
        _configuration = configuration;
        _hubContext = hubContext;
    }

    [HttpGet("health")]
    public IActionResult Health() => Ok(new { status = "healthy" });

    [HttpGet("debug/config")]
    public IActionResult DebugConfig()
    {
        var workerSecret = _configuration["Worker:SharedSecret"];
        var hasSecret = !string.IsNullOrEmpty(workerSecret);
        return Ok(new { 
            hasWorkerSecret = hasSecret,
            secretLength = workerSecret?.Length ?? 0,
            // Don't expose the actual secret, just first/last chars for verification
            secretPreview = hasSecret ? $"{workerSecret[0]}...{workerSecret[^1]}" : "NOT_SET"
        });
    }

    private bool IsWorkerAuthorized()
    {
        var apiKeyHeader = Request.Headers["X-Worker-Secret"].ToString();
        var workerSecret = _configuration["Worker:SharedSecret"];
        
        // Debug logging
        Console.WriteLine($"[Auth Check] Header present: {!string.IsNullOrEmpty(apiKeyHeader)}, Config present: {!string.IsNullOrEmpty(workerSecret)}");
        
        if (string.IsNullOrEmpty(workerSecret))
        {
            Console.WriteLine("[Auth Check] WARNING: Worker:SharedSecret not configured!");
            return false;
        }
        
        if (string.IsNullOrEmpty(apiKeyHeader))
        {
            Console.WriteLine("[Auth Check] WARNING: X-Worker-Secret header missing!");
            return false;
        }
        
        var isMatch = apiKeyHeader == workerSecret;
        Console.WriteLine($"[Auth Check] Secrets match: {isMatch}");
        
        return isMatch;
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetSession(Guid userId)
    {
        // Allowed for both Worker and Frontend
        var session = await _context.WhatsAppSessions.FindAsync(userId);
        if (session == null)
        {
            session = new WhatsAppSession { UserId = userId };
            _context.WhatsAppSessions.Add(session);
            await _context.SaveChangesAsync();
        }

        return Ok(new 
        { 
            session.Status,
            session.SystemPrompt,
            // Only worker needs blob/IV, but for simplicity returning common info
            session.SessionBlob,
            session.EncryptionIV
        });
    }

    [HttpPost("{userId}")]
    public async Task<IActionResult> UpdateSession(Guid userId, [FromBody] UpdateSessionRequest request)
    {
        if (!IsWorkerAuthorized()) return Unauthorized();

        var session = await _context.WhatsAppSessions.FindAsync(userId);
        if (session == null)
        {
            session = new WhatsAppSession
            {
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            _context.WhatsAppSessions.Add(session);
        }

        session.SessionBlob = request.SessionBlob;
        session.EncryptionIV = request.EncryptionIv;
        session.LastSyncedAt = DateTime.UtcNow;
        session.Status = "connected"; // Assume connected if syncing

        await _context.SaveChangesAsync();
        
        // Notify frontend via SignalR
        await _hubContext.Clients.Group(userId.ToString()).SendAsync("SessionUpdated", new { session.Status });
        
        return Ok();
    }

    [HttpPost("{userId}/status")]
    public async Task<IActionResult> UpdateStatus(Guid userId, [FromBody] StatusUpdateRequest request)
    {
        if (!IsWorkerAuthorized()) return Unauthorized();

        var session = await _context.WhatsAppSessions.FindAsync(userId);
        if (session == null)
        {
            // Create session if it doesn't exist
            session = new WhatsAppSession 
            { 
                UserId = userId,
                Status = request.Status,
                CreatedAt = DateTime.UtcNow,
                LastSyncedAt = DateTime.UtcNow
            };
            _context.WhatsAppSessions.Add(session);
        }
        else
        {
            session.Status = request.Status;
        }

        await _context.SaveChangesAsync();

        // Broadcast to SignalR (wrapped in try-catch to prevent 500 errors)
        try
        {
            await _hubContext.Clients.Group(userId.ToString()).SendAsync("StatusUpdate", new { request.Status, request.Qr });
        }
        catch (Exception ex)
        {
            // Log but don't fail the request
            Console.WriteLine($"SignalR broadcast failed: {ex.Message}");
        }

        return Ok();
    }

    [HttpPost("{userId}/soul")]
    public async Task<IActionResult> UpdateSystemPrompt(Guid userId, [FromBody] UpdateSoulRequest request)
    {
        var session = await _context.WhatsAppSessions.FirstOrDefaultAsync(s => s.UserId == userId);
        if (session == null)
        {
            session = new WhatsAppSession { UserId = userId };
            _context.WhatsAppSessions.Add(session);
        }

        session.SystemPrompt = request.SystemPrompt;
        await _context.SaveChangesAsync();
        return Ok();
    }
}

public class UpdateSoulRequest
{
    public string SystemPrompt { get; set; } = string.Empty;
}

public class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
    public string? Qr { get; set; }
}

public class UpdateSessionRequest
{
    public string SessionBlob { get; set; } = string.Empty;
    public string EncryptionIv { get; set; } = string.Empty;
}
