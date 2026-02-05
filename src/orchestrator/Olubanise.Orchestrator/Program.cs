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

// Database Context - Support both explicit connection string and Render's DATABASE_URL
// Use a factory to ensure connection string is retrieved fresh each time
builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
{
    var configuration = serviceProvider.GetRequiredService<IConfiguration>();
    
    var connectionString = configuration.GetConnectionString("DefaultConnection") 
                          ?? configuration["DATABASE_URL"]
                          ?? Environment.GetEnvironmentVariable("DATABASE_URL");
    
    if (string.IsNullOrEmpty(connectionString))
    {
        Console.WriteLine("[DbContext] WARNING: No database connection string found!");
        connectionString = "Host=localhost;Database=olubanise;Username=postgres;Password=password";
    }
    else
    {
        Console.WriteLine($"[DbContext] Using connection string (length: {connectionString.Length})");
    }
    
    options.UseNpgsql(connectionString);
});

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
