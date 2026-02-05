using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;
using BCrypt.Net;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuthController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] AuthRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest("User already exists.");

        var user = new User
        {
            Email = request.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password)
        };

        _context.Users.Add(user);
        
        // Initialize Security Settings
        _context.SecuritySettings.Add(new SecuritySettings { UserId = user.Id });
        
        // Initialize Wallet
        _context.Wallets.Add(new Wallet { UserId = user.Id, Balance = 50.00m }); // Give 50 free credits
        
        await _context.SaveChangesAsync();
        return Ok(new { user.Id, user.Email });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AuthRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        return Ok(new { user.Id, user.Email });
    }
}

public class AuthRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
