namespace KudibaInvoicing.Domain.Ports;

public record SignedInvoiceResult(
    string SignatureBase64,
    string HashSha256,
    string ValidationChars,
    DateTime SignedAt
);

public interface IRsaCryptoSigner
{
    SignedInvoiceResult SignCanonicalBuffer(string canonicalBuffer, string? privateKeyPem = null);
    bool VerifySignature(string canonicalBuffer, string signatureBase64, string? publicKeyPem = null);
    string GetPublicKeyPem();
    string GetKeyVersion();
}
