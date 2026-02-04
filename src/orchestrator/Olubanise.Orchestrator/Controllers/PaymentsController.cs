using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Olubanise.Orchestrator.Data;

namespace Olubanise.Orchestrator.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public PaymentsController(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("initialize")]
    public async Task<IActionResult> InitializePayment([FromBody] PaymentInitRequest request)
    {
        // TODO: Call Paystack API to initialize transaction
        // Return reference and authorization URL
        return Ok(new { reference = Guid.NewGuid().ToString(), url = "https://checkout.paystack.com/..." });
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> PaystackWebhook()
    {
        // TODO: Verify signature and update wallet balance
        return Ok();
    }

    [HttpGet("{userId}/wallet")]
    public async Task<IActionResult> GetWallet(Guid userId)
    {
        var wallet = await _context.Wallets.FirstOrDefaultAsync(w => w.UserId == userId);
        if (wallet == null)
        {
            wallet = new Wallet { UserId = userId, Balance = 0 };
            _context.Wallets.Add(wallet);
            await _context.SaveChangesAsync();
        }

        var transactions = await _context.TransactionLogs
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.Timestamp)
            .Take(10)
            .ToListAsync();

        return Ok(new { balance = wallet.Balance, transactions });
    }
}

public class PaymentInitRequest
{
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public string Email { get; set; } = string.Empty;
}
