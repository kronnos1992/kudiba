namespace KudibaInvoicing.Domain.Entities;

public class Invoice
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid SeriesId { get; private set; }
    public string DocumentNumber { get; private set; } = string.Empty;
    public long SequenceNumber { get; private set; }
    public string DocumentType { get; private set; } = string.Empty;
    public string CustomerName { get; private set; } = string.Empty;
    public string CustomerNif { get; private set; } = "Consumidor Final";
    public string Currency { get; private set; } = "AOA";
    public decimal NetTotal { get; private set; }
    public decimal TaxTotal { get; private set; }
    public decimal GrossTotal { get; private set; }
    public string HashSha256 { get; private set; } = string.Empty;
    public string SignatureRsaBase64 { get; private set; } = string.Empty;
    public string ValidationChars { get; private set; } = string.Empty;
    public string KeyVersion { get; private set; } = "1";
    public bool IsContingency { get; private set; }
    public DateTime IssuedAt { get; private set; }
    public DateTime SystemEntryDate { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public List<InvoiceLine> Lines { get; private set; } = new();

    public Invoice() { }

    public Invoice(
        Guid id,
        Guid tenantId,
        Guid seriesId,
        string documentNumber,
        long sequenceNumber,
        string documentType,
        string customerName,
        string customerNif,
        string currency,
        decimal netTotal,
        decimal taxTotal,
        decimal grossTotal,
        string hashSha256,
        string signatureRsaBase64,
        string validationChars,
        string keyVersion,
        bool isContingency,
        DateTime issuedAt,
        DateTime systemEntryDate,
        List<InvoiceLine> lines)
    {
        Id = id;
        TenantId = tenantId;
        SeriesId = seriesId;
        DocumentNumber = documentNumber;
        SequenceNumber = sequenceNumber;
        DocumentType = documentType;
        CustomerName = customerName;
        CustomerNif = string.IsNullOrWhiteSpace(customerNif) ? "Consumidor Final" : customerNif;
        Currency = currency;
        NetTotal = netTotal;
        TaxTotal = taxTotal;
        GrossTotal = grossTotal;
        HashSha256 = hashSha256;
        SignatureRsaBase64 = signatureRsaBase64;
        ValidationChars = validationChars;
        KeyVersion = keyVersion;
        IsContingency = isContingency;
        IssuedAt = issuedAt;
        SystemEntryDate = systemEntryDate;
        CreatedAt = DateTime.UtcNow;
        Lines = lines;
    }
}
