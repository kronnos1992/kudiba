using System.Text.Json;
using KudibaInvoicing.Api.Services;
using KudibaInvoicing.Application;
using KudibaInvoicing.Application.Commands.IssueInvoice;
using KudibaInvoicing.Application.Queries.GetInvoice;
using KudibaInvoicing.Domain.Ports;
using KudibaInvoicing.Infrastructure;
using MediatR;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel to support HTTP/1.1 and HTTP/2 on port 9090
builder.WebHost.ConfigureKestrel(options =>
{
    int port = int.TryParse(Environment.GetEnvironmentVariable("PORT"), out var p) ? p : 9090;
    options.ListenAnyIP(port, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});

// Add Layer Dependencies
builder.Services.AddApplication();
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DATABASE_URL"]
    ?? "Host=postgres;Port=5432;Database=kudiba_erp;Username=kudiba;Password=kudiba_secret_pass";
builder.Services.AddInfrastructure(connectionString);

// Add gRPC
builder.Services.AddGrpc();

var app = builder.Build();

// Map gRPC Service
app.MapGrpcService<FiscalGrpcService>();

// Health Check Endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "KudibaInvoicing",
    version = "1.0.0",
    framework = ".NET 10",
    regulation = "Decreto Presidencial n.º 71/25 (AGT Angola)",
    timestamp = DateTime.UtcNow
}));

// Root Info Endpoint
app.MapGet("/", () => Results.Ok(new
{
    service = "KudibaInvoicing Engine & Fiscal Core",
    version = "1.0.0",
    framework = ".NET 10 (C#)",
    grpc = "FiscalEngineService on port 9090",
    docs = "https://github.com/kudiba/kudiba-core"
}));

// REST: Issue Invoice (supports direct and gateway forwarded routes)
async Task<IResult> IssueInvoiceHandler(IssueInvoiceCommand command, IMediator mediator)
{
    try
    {
        var result = await mediator.Send(command);
        return Results.Created($"/api/v1/invoices/{result.InvoiceId}", result);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: ex.Message, statusCode: 500);
    }
}

app.MapPost("/api/v1/invoices", IssueInvoiceHandler);
app.MapPost("/api/v1/fiscal/invoices", IssueInvoiceHandler);

// REST: Get Invoice by ID
async Task<IResult> GetInvoiceHandler(Guid id, IMediator mediator)
{
    var invoice = await mediator.Send(new GetInvoiceQuery(Guid.Empty, InvoiceId: id));
    return invoice != null ? Results.Ok(invoice) : Results.NotFound(new { error = "Invoice not found." });
}

app.MapGet("/api/v1/invoices/{id:guid}", GetInvoiceHandler);
app.MapGet("/api/v1/fiscal/invoices/{id:guid}", GetInvoiceHandler);

// REST: Get RSA Public Key
IResult GetPublicKeyHandler(IRsaCryptoSigner signer) => Results.Ok(new
{
    keyVersion = signer.GetKeyVersion(),
    publicKeyPem = signer.GetPublicKeyPem(),
    algorithm = "RSA-2048 / SHA-256 PKCS#1 v1.5"
});

app.MapGet("/api/v1/public-key", GetPublicKeyHandler);
app.MapGet("/api/v1/fiscal/public-key", GetPublicKeyHandler);

app.Run();
