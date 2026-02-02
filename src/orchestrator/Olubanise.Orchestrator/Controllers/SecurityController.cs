using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/security/{userId}")]
public class SecurityController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SecurityController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings(Guid userId)
    {
        var settings = await _context.SecuritySettings.FindAsync(userId);
        if (settings == null)
        {
            settings = new SecuritySettings { UserId = userId };
            _context.SecuritySettings.Add(settings);
            await _context.SaveChangesAsync();
        }
        return Ok(settings);
    }

    [HttpPost("settings")]
    public async Task<IActionResult> UpdateSettings(Guid userId, [FromBody] SecuritySettings model)
    {
        var settings = await _context.SecuritySettings.FindAsync(userId);
        if (settings == null)
        {
            settings = new SecuritySettings { UserId = userId };
            _context.SecuritySettings.Add(settings);
        }

        settings.RequireApprovalForDestructive = model.RequireApprovalForDestructive;
        settings.RestrictToWorkFolder = model.RestrictToWorkFolder;
        settings.WorkDirectory = model.WorkDirectory;

        await _context.SaveChangesAsync();
        return Ok(settings);
    }

    [HttpGet("trusted")]
    public async Task<IActionResult> GetTrustedSources(Guid userId)
    {
        var sources = await _context.TrustedSources
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();
        return Ok(sources);
    }

    [HttpPost("trusted")]
    public async Task<IActionResult> AddTrustedSource(Guid userId, [FromBody] TrustedSource source)
    {
        source.UserId = userId;
        source.Id = Guid.NewGuid();
        source.CreatedAt = DateTime.UtcNow;
        
        _context.TrustedSources.Add(source);
        await _context.SaveChangesAsync();
        return Ok(source);
    }

    [HttpDelete("trusted/{id}")]
    public async Task<IActionResult> RemoveTrustedSource(Guid userId, Guid id)
    {
        var source = await _context.TrustedSources.FirstOrDefaultAsync(s => s.Id == id && s.UserId == userId);
        if (source == null) return NotFound();

        _context.TrustedSources.Remove(source);
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogs(Guid userId)
    {
        var logs = await _context.SecurityAuditLogs
            .Where(l => l.UserId == userId)
            .OrderByDescending(l => l.Timestamp)
            .Take(50)
            .ToListAsync();
        return Ok(logs);
    }
}
