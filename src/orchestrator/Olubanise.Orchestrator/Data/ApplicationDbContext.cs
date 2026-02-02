using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Olubanise.Orchestrator.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<Wallet> Wallets { get; set; }
    public DbSet<WhatsAppSession> WhatsAppSessions { get; set; }
    public DbSet<TransactionLog> TransactionLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Wallet>()
            .HasIndex(w => w.UserId)
            .IsUnique();

        modelBuilder.Entity<TransactionLog>()
            .HasIndex(t => t.UserId);

        modelBuilder.Entity<WhatsAppSession>()
            .HasKey(s => s.UserId);
    }
}

public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    public string PasswordHash { get; set; } = string.Empty;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class Wallet
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal Balance { get; set; } = 0.0000m;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class WhatsAppSession
{
    [Key]
    public Guid UserId { get; set; }
    
    public string? SessionBlob { get; set; }
    public string? EncryptionIV { get; set; }
    
    [MaxLength(50)]
    public string Status { get; set; } = "disconnected";

    public string SystemPrompt { get; set; } = "You are Olubanise, a helpful AI personal assistant. Be concise and professional.";
    
    public DateTime LastSyncedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class TransactionLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    
    [Required]
    public Guid UserId { get; set; }
    
    [Required]
    public Guid WalletId { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal Amount { get; set; }
    
    [Required, MaxLength(50)]
    public string TransactionType { get; set; } = "DEBIT"; // CREDIT, DEBIT
    
    public string? Description { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
