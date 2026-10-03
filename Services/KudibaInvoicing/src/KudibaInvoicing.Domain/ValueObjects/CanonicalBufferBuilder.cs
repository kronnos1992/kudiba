using System.Globalization;

namespace KudibaInvoicing.Domain.ValueObjects;

public static class CanonicalBufferBuilder
{
    /// <summary>
    /// Builds the canonical AGT string for RSA-SHA256 signature chaining according to Decreto Presidencial n.º 71/25:
    /// Format: "{InvoiceDate};{SystemEntryDate};{DocumentNumber};{GrossTotal};{PreviousHash}"
    /// </summary>
    public static string Build(
        DateTime invoiceDate,
        DateTime systemEntryDate,
        string documentNumber,
        decimal grossTotal,
        string previousHash)
    {
        string dateStr = invoiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        string entryDateStr = systemEntryDate.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        string grossTotalStr = grossTotal.ToString("F2", CultureInfo.InvariantCulture);
        string prevHash = previousHash?.Trim() ?? string.Empty;

        return $"{dateStr};{entryDateStr};{documentNumber};{grossTotalStr};{prevHash}";
    }
}
