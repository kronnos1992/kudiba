namespace KudibaInvoicing.Domain.Entities;

public class FiscalSeries
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string DocumentType { get; private set; } = string.Empty;
    public string SeriesCode { get; private set; } = string.Empty;
    public int FiscalYear { get; private set; }
    public long CurrentSequence { get; private set; }
    public string LastHash { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public DateTime CreatedAt { get; private set; }

    // Parameterless constructor for Dapper mapping
    public FiscalSeries() { }

    public FiscalSeries(Guid id, Guid tenantId, string documentType, string seriesCode, int fiscalYear, long currentSequence = 0, string lastHash = "", bool isActive = true)
    {
        Id = id;
        TenantId = tenantId;
        DocumentType = documentType.ToUpperInvariant();
        SeriesCode = seriesCode.ToUpperInvariant();
        FiscalYear = fiscalYear;
        CurrentSequence = currentSequence;
        LastHash = lastHash;
        IsActive = isActive;
        CreatedAt = DateTime.UtcNow;
    }

    public long NextSequence() => CurrentSequence + 1;

    public void AdvanceSequence(string newHash)
    {
        if (string.IsNullOrWhiteSpace(newHash))
            throw new ArgumentException("Hash cannot be empty when advancing sequence", nameof(newHash));

        CurrentSequence++;
        LastHash = newHash;
    }

    public string FormatDocumentNumber(long sequence)
    {
        return $"{DocumentType} {SeriesCode}/{sequence:D6}";
    }
}
