namespace KudibaInvoicing.Domain.Entities;

public class InvoiceLine
{
    public Guid Id { get; private set; }
    public Guid InvoiceId { get; private set; }
    public int LineNumber { get; private set; }
    public string ProductCode { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TaxRate { get; private set; }
    public string? TaxExemptionCode { get; private set; }
    public decimal LineTotal { get; private set; }

    public InvoiceLine() { }

    public InvoiceLine(
        Guid id,
        Guid invoiceId,
        int lineNumber,
        string productCode,
        string description,
        decimal quantity,
        decimal unitPrice,
        decimal taxRate,
        string? taxExemptionCode,
        decimal lineTotal)
    {
        Id = id;
        InvoiceId = invoiceId;
        LineNumber = lineNumber;
        ProductCode = productCode;
        Description = description;
        Quantity = quantity;
        UnitPrice = unitPrice;
        TaxRate = taxRate;
        TaxExemptionCode = taxExemptionCode;
        LineTotal = lineTotal;
    }
}
