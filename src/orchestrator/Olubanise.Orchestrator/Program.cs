using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using Olubanise.Orchestrator.Data;
using Olubanise.Orchestrator.Services;
using Olubanise.Orchestrator.Hubs;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

Console.WriteLine("=== CONFIGURING DATABASE ===");

// Database Context - Support both explicit connection string and Render's DATABASE_URL
// Use a factory to ensure connection string is retrieved fresh each time
builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
{
    Console.WriteLine("[DbContext Factory] Creating DbContext...");
    
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    
    var connStr1 = configuration.GetConnectionString("DefaultConnection");
    var connStr2 = configuration["DATABASE_URL"];
    var connStr3 = Environment.GetEnvironmentVariable("DATABASE_URL");
    
    Console.WriteLine($"[DbContext] ConnectionStrings:DefaultConnection = {(string.IsNullOrEmpty(connStr1) ? "NULL/EMPTY" : $"SET (length: {connStr1.Length})")}");
    Console.WriteLine($"[DbContext] Configuration[DATABASE_URL] = {(string.IsNullOrEmpty(connStr2) ? "NULL/EMPTY" : $"SET (length: {connStr2.Length})")}");
    Console.WriteLine($"[DbContext] Environment.GetEnvironmentVariable(DATABASE_URL) = {(string.IsNullOrEmpty(connStr3) ? "NULL/EMPTY" : $"SET (length: {connStr3.Length})")}");
    
    var connectionString = connStr1 ?? connStr2 ?? connStr3;
    
    if (string.IsNullOrEmpty(connectionString))
    {
        Console.WriteLine("[DbContext] ERROR: No database connection string found!");
        connectionString = "Host=localhost;Database=olubanise;Username=postgres;Password=password";
    }
    else
    {
        Console.WriteLine($"[DbContext] SUCCESS: Using connection string (length: {connectionString.Length}, preview: {connectionString.Substring(0, Math.Min(20, connectionString.Length))}...)");
    }
    
    options.UseNpgsql(connectionString);
});

Console.WriteLine("=== DATABASE CONFIGURED ===");

// Custom Services
builder.Services.AddScoped<IEncryptionService, EncryptionService>();

// SignalR
builder.Services.AddSignalR();

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueLimit = 2;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
    });
});

// CORS for React Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://olubanise.work") // Local Vite and Production
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseRateLimiter();

app.UseAuthorization();

app.MapControllers();
app.MapHub<OlubaniseHub>("/hubs/olubanise");

app.Run();
