using MediatR;
using KudibaInvoicing.Domain.Ports;
using KudibaInvoicing.Domain.ValueObjects;

namespace KudibaInvoicing.Application.Queries.VerifySignature;

public record VerifySignatureQuery(
    string TenantId,
    string DocumentNumber,
    string SignatureBase64,
    string InvoiceDate,
    string SystemEntryDate,
    double GrossTotal,
    string PreviousHash,
    string KeyVersion
) : IRequest<VerifySignatureResultDto>;

public record VerifySignatureResultDto(
    bool IsValid,
    string ValidationChars,
    string ErrorMessage
);

public class VerifySignatureQueryHandler : IRequestHandler<VerifySignatureQuery, VerifySignatureResultDto>
{
    private readonly IRsaCryptoSigner _cryptoSigner;

    public VerifySignatureQueryHandler(IRsaCryptoSigner cryptoSigner)
    {
        _cryptoSigner = cryptoSigner;
    }

    public Task<VerifySignatureResultDto> Handle(VerifySignatureQuery request, CancellationToken cancellationToken)
    {
        try
        {
            DateTime invDate = DateTime.TryParse(request.InvoiceDate, out var id) ? id : DateTime.UtcNow.Date;
            DateTime sysDate = DateTime.TryParse(request.SystemEntryDate, out var sd) ? sd : DateTime.UtcNow;

            string canonicalBuffer = CanonicalBufferBuilder.Build(
                invDate,
                sysDate,
                request.DocumentNumber,
                (decimal)request.GrossTotal,
                request.PreviousHash
            );

            bool isValid = _cryptoSigner.VerifySignature(canonicalBuffer, request.SignatureBase64);
            string validationChars = isValid ? ValidationCode.ExtractFromBase64Signature(request.SignatureBase64) : string.Empty;

            return Task.FromResult(new VerifySignatureResultDto(
                isValid,
                validationChars,
                isValid ? string.Empty : "Digital signature verification failed against canonical buffer."
            ));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new VerifySignatureResultDto(
                false,
                string.Empty,
                $"Verification error: {ex.Message}"
            ));
        }
    }
}
