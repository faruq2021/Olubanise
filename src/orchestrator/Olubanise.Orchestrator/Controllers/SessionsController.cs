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

    private bool IsWorkerAuthorized()
    {
        var apiKeyHeader = Request.Headers["X-Worker-Secret"].ToString();
        var workerSecret = _configuration["Worker:SharedSecret"];
        return !string.IsNullOrEmpty(apiKeyHeader) && apiKeyHeader == workerSecret;
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
        if (session != null)
        {
            session.Status = request.Status;
            await _context.SaveChangesAsync();
        }

        // Broadcast to SignalR
        await _hubContext.Clients.Group(userId.ToString()).SendAsync("StatusUpdate", new { request.Status, request.Qr });

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
