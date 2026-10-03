using KudibaInvoicing.Domain.Entities;

namespace KudibaInvoicing.Domain.Ports;

public interface IInvoiceRepository
{
    Task SaveAsync(Invoice invoice, CancellationToken cancellationToken = default);
    Task<Invoice?> GetByDocumentNumberAsync(Guid tenantId, string documentNumber, CancellationToken cancellationToken = default);
    Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
}
