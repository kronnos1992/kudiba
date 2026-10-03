using KudibaInvoicing.Domain.Entities;

namespace KudibaInvoicing.Domain.Ports;

public interface IFiscalSeriesRepository
{
    Task<FiscalSeries?> GetAndLockAsync(Guid tenantId, string documentType, string seriesCode, int fiscalYear, CancellationToken cancellationToken = default);
    Task<FiscalSeries?> GetByCodeAsync(Guid tenantId, string documentType, string seriesCode, int fiscalYear, CancellationToken cancellationToken = default);
    Task CreateAsync(FiscalSeries series, CancellationToken cancellationToken = default);
    Task UpdateSequenceAndHashAsync(Guid seriesId, long newSequence, string newHash, CancellationToken cancellationToken = default);
}
