using MediatR;

namespace KudibaInvoicing.Application.Commands.IssueInvoice;

public record InvoiceLineInputDto(
    string ProductCode,
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal TaxRate,
    string? TaxExemptionCode = null
);

public record IssueInvoiceCommand(
    Guid TenantId,
    string DocumentType,
    string SeriesCode,
    int FiscalYear,
    string CustomerName,
    string CustomerNif,
    string Currency,
    List<InvoiceLineInputDto> Lines,
    bool IsContingency = false,
    string KeyVersion = "1"
) : IRequest<IssueInvoiceResultDto>;

public record IssueInvoiceResultDto(
    Guid InvoiceId,
    string DocumentNumber,
    long SequenceNumber,
    decimal NetTotal,
    decimal TaxTotal,
    decimal GrossTotal,
    string HashSha256,
    string SignatureRsaBase64,
    string ValidationChars,
    DateTime IssuedAt,
    DateTime SystemEntryDate,
    bool IsContingency
);
