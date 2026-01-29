using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public SessionsController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    private bool IsWorkerAuthorized()
    {
        var apiKeyHeader = Request.Headers["X-Worker-Secret"].ToString();
        var workerSecret = _configuration["Worker:SharedSecret"];
        return !string.IsNullOrEmpty(apiKeyHeader) && apiKeyHeader == workerSecret;
    }

    [HttpGet("{userId}")]
    public async Task<IActionResult> GetSession(Guid userId)
    {
        if (!IsWorkerAuthorized()) return Unauthorized();

        var session = await _context.WhatsAppSessions.FindAsync(userId);
        if (session == null) return NotFound();

        return Ok(new 
        { 
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
        return Ok();
    }
}

public class UpdateSessionRequest
{
    public string SessionBlob { get; set; } = string.Empty;
    public string EncryptionIv { get; set; } = string.Empty;
}
