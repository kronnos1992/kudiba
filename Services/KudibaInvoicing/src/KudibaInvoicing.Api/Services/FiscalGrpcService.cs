using Grpc.Core;
using Kudiba.Fiscal.V1;
using KudibaInvoicing.Application.Commands.SignDirect;
using KudibaInvoicing.Application.Queries.ValidateSeriesSequence;
using KudibaInvoicing.Application.Queries.VerifySignature;
using MediatR;

namespace KudibaInvoicing.Api.Services;

public class FiscalGrpcService : FiscalEngineService.FiscalEngineServiceBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<FiscalGrpcService> _logger;

    public FiscalGrpcService(IMediator mediator, ILogger<FiscalGrpcService> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public override async Task<SignDocumentResponse> SignDocument(SignDocumentRequest request, ServerCallContext context)
    {
        _logger.LogInformation("gRPC SignDocument received for Doc: {DocNumber}, Tenant: {TenantId}", request.DocumentNumber, request.TenantId);

        var command = new SignDirectCommand(
            request.TenantId,
            request.DocumentNumber,
            request.InvoiceDate,
            request.SystemEntryDate,
            request.GrossTotal,
            request.PreviousHash,
            request.KeyVersion
        );

        var result = await _mediator.Send(command, context.CancellationToken);

        return new SignDocumentResponse
        {
            DocumentNumber = result.DocumentNumber,
            SignatureBase64 = result.SignatureBase64,
            HashSha256 = result.HashSha256,
            ValidationChars = result.ValidationChars,
            SignedAt = result.SignedAt,
            IsContingency = result.IsContingency
        };
    }

    public override async Task<VerifySignatureResponse> VerifySignature(VerifySignatureRequest request, ServerCallContext context)
    {
        _logger.LogInformation("gRPC VerifySignature received for Doc: {DocNumber}", request.DocumentNumber);

        var query = new VerifySignatureQuery(
            request.TenantId,
            request.DocumentNumber,
            request.SignatureBase64,
            request.InvoiceDate,
            request.SystemEntryDate,
            request.GrossTotal,
            request.PreviousHash,
            request.KeyVersion
        );

        var result = await _mediator.Send(query, context.CancellationToken);

        return new VerifySignatureResponse
        {
            IsValid = result.IsValid,
            ValidationChars = result.ValidationChars,
            ErrorMessage = result.ErrorMessage
        };
    }

    public override async Task<ValidateSeriesSequenceResponse> ValidateSeriesSequence(ValidateSeriesSequenceRequest request, ServerCallContext context)
    {
        _logger.LogInformation("gRPC ValidateSeriesSequence received for Series: {SeriesCode}, ExpectedSeq: {ExpectedSeq}", request.SeriesCode, request.ExpectedSequence);

        var query = new ValidateSeriesSequenceQuery(
            request.TenantId,
            request.SeriesCode,
            request.ExpectedSequence,
            (int)request.DocumentYear
        );

        var result = await _mediator.Send(query, context.CancellationToken);

        return new ValidateSeriesSequenceResponse
        {
            IsValid = result.IsValid,
            LastRecordedSequence = result.LastRecordedSequence,
            LastDocumentHash = result.LastDocumentHash,
            IsGapDetected = result.IsGapDetected
        };
    }

    public override Task<TriggerSaftGenerationResponse> TriggerSaftGeneration(TriggerSaftGenerationRequest request, ServerCallContext context)
    {
        _logger.LogInformation("gRPC TriggerSaftGeneration received for Year: {Year}, Month: {Month}, Tenant: {Tenant}", request.FiscalYear, request.FiscalMonth, request.TenantId);

        string jobId = Guid.NewGuid().ToString("N");
        return Task.FromResult(new TriggerSaftGenerationResponse
        {
            JobId = jobId,
            Status = "QUEUED",
            EstimatedTime = "30s"
        });
    }
}
