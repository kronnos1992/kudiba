namespace KudibaInvoicing.Domain.ValueObjects;

public static class ValidationCode
{
    /// <summary>
    /// Extracts the 4 validation characters mandated by Angola Decreto Presidencial n.º 71/25 (AGT).
    /// These are the 1st, 11th, 21st, and 31st characters of the Base64-encoded RSA digital signature.
    /// In a zero-indexed string: indices 0, 10, 20, and 30.
    /// </summary>
    public static string ExtractFromBase64Signature(string base64Signature)
    {
        if (string.IsNullOrEmpty(base64Signature) || base64Signature.Length < 31)
            throw new ArgumentException("Base64 signature string is too short to extract 4 validation characters (min 31 chars required).", nameof(base64Signature));

        return $"{base64Signature[0]}{base64Signature[10]}{base64Signature[20]}{base64Signature[30]}";
    }
}
