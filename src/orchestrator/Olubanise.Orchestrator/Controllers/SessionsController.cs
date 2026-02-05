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
        
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        var hasConnectionString = !string.IsNullOrEmpty(connectionString);
        
        return Ok(new { 
            hasWorkerSecret = hasSecret,
            secretLength = workerSecret?.Length ?? 0,
            secretPreview = hasSecret ? $"{workerSecret[0]}...{workerSecret[^1]}" : "NOT_SET",
            hasConnectionString = hasConnectionString,
            connectionStringLength = connectionString?.Length ?? 0,
            connectionStringPreview = hasConnectionString ? $"{connectionString.Substring(0, Math.Min(15, connectionString.Length))}..." : "NOT_SET"
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
        try
        {
            Console.WriteLine($"[UpdateStatus] Received request for userId: {userId}, status: {request.Status}");
            
            if (!IsWorkerAuthorized())
            {
                Console.WriteLine("[UpdateStatus] Authorization failed");
                return Unauthorized();
            }

            Console.WriteLine("[UpdateStatus] Authorization successful");

            var session = await _context.WhatsAppSessions.FindAsync(userId);
            if (session == null)
            {
                Console.WriteLine($"[UpdateStatus] Creating new session for {userId}");
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
                Console.WriteLine($"[UpdateStatus] Updating existing session for {userId}");
                session.Status = request.Status;
            }

            Console.WriteLine("[UpdateStatus] Saving to database...");
            await _context.SaveChangesAsync();
            Console.WriteLine("[UpdateStatus] Database save successful");

            // Broadcast to SignalR (wrapped in try-catch to prevent 500 errors)
            try
            {
                await _hubContext.Clients.Group(userId.ToString()).SendAsync("StatusUpdate", new { request.Status, request.Qr });
                Console.WriteLine("[UpdateStatus] SignalR broadcast successful");
            }
            catch (Exception ex)
            {
                // Log but don't fail the request
                Console.WriteLine($"[UpdateStatus] SignalR broadcast failed: {ex.Message}");
            }

            Console.WriteLine("[UpdateStatus] Request completed successfully");
            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[UpdateStatus] FATAL ERROR: {ex.GetType().Name}: {ex.Message}");
            Console.WriteLine($"[UpdateStatus] Stack trace: {ex.StackTrace}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"[UpdateStatus] Inner exception: {ex.InnerException.Message}");
            }
            return StatusCode(500, new { error = ex.Message, type = ex.GetType().Name });
        }
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
