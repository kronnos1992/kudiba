using MediatR;
using KudibaInvoicing.Domain.Entities;
using KudibaInvoicing.Domain.Ports;

namespace KudibaInvoicing.Application.Queries.GetInvoice;

public record GetInvoiceQuery(
    Guid TenantId,
    string? DocumentNumber = null,
    Guid? InvoiceId = null
) : IRequest<Invoice?>;

public class GetInvoiceQueryHandler : IRequestHandler<GetInvoiceQuery, Invoice?>
{
    private readonly IInvoiceRepository _invoiceRepository;

    public GetInvoiceQueryHandler(IInvoiceRepository invoiceRepository)
    {
        _invoiceRepository = invoiceRepository;
    }

    public async Task<Invoice?> Handle(GetInvoiceQuery request, CancellationToken cancellationToken)
    {
        if (request.InvoiceId.HasValue)
        {
            return await _invoiceRepository.GetByIdAsync(request.InvoiceId.Value, cancellationToken);
        }

        if (!string.IsNullOrEmpty(request.DocumentNumber))
        {
            return await _invoiceRepository.GetByDocumentNumberAsync(request.TenantId, request.DocumentNumber, cancellationToken);
        }

        return null;
    }
}
