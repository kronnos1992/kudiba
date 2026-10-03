using KudibaInvoicing.Domain.Ports;
using KudibaInvoicing.Infrastructure.Crypto;
using KudibaInvoicing.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace KudibaInvoicing.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        services.AddScoped<IUnitOfWork>(_ => new PostgreSqlUnitOfWork(connectionString));
        services.AddScoped<IFiscalSeriesRepository, PostgreSqlFiscalSeriesRepository>();
        services.AddScoped<IInvoiceRepository, PostgreSqlInvoiceRepository>();
        services.AddSingleton<IRsaCryptoSigner, RsaCryptoSigner>();

        return services;
    }
}
