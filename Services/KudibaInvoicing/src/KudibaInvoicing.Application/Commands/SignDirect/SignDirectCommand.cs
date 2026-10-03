using MediatR;
using KudibaInvoicing.Domain.Ports;
using KudibaInvoicing.Domain.ValueObjects;

namespace KudibaInvoicing.Application.Commands.SignDirect;

public record SignDirectCommand(
    string TenantId,
    string DocumentNumber,
    string InvoiceDate,
    string SystemEntryDate,
    double GrossTotal,
    string PreviousHash,
    string KeyVersion
) : IRequest<SignDirectResultDto>;

public record SignDirectResultDto(
    string DocumentNumber,
    string SignatureBase64,
    string HashSha256,
    string ValidationChars,
    string SignedAt,
    bool IsContingency
);

public class SignDirectCommandHandler : IRequestHandler<SignDirectCommand, SignDirectResultDto>
{
    private readonly IRsaCryptoSigner _cryptoSigner;

    public SignDirectCommandHandler(IRsaCryptoSigner cryptoSigner)
    {
        _cryptoSigner = cryptoSigner;
    }

    public Task<SignDirectResultDto> Handle(SignDirectCommand request, CancellationToken cancellationToken)
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

        var signResult = _cryptoSigner.SignCanonicalBuffer(canonicalBuffer);

        var result = new SignDirectResultDto(
            request.DocumentNumber,
            signResult.SignatureBase64,
            signResult.HashSha256,
            signResult.ValidationChars,
            signResult.SignedAt.ToString("o"),
            false
        );

        return Task.FromResult(result);
    }
}
