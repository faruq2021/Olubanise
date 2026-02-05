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
    public DbSet<SecuritySettings> SecuritySettings { get; set; }
    public DbSet<TrustedSource> TrustedSources { get; set; }
    public DbSet<SecurityAuditLog> SecurityAuditLogs { get; set; }

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
    
    public string? PendingCommand { get; set; }
    public DateTime? PendingCommandTime { get; set; }
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

public class SecuritySettings
{
    [Key]
    public Guid UserId { get; set; }
    public bool RequireApprovalForDestructive { get; set; } = true;
    public bool RestrictToWorkFolder { get; set; } = true;
    public string WorkDirectory { get; set; } = @"C:\OlubaniseWork";
}

public class TrustedSource
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string? PhoneNumber { get; set; } // For WhatsApp JID
    public string? Email { get; set; }
    public string Platform { get; set; } = "WhatsApp"; // or "Email"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class SecurityAuditLog
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public required string Action { get; set; } // "File Delete", "Format"
    public required string Resource { get; set; } // "report.docx"
    public required string Status { get; set; } // "Allowed", "Blocked", "Pending"
    public required string Reason { get; set; } // "Destructive command blocked"
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
