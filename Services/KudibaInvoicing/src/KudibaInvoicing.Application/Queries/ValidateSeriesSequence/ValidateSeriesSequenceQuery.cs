using MediatR;
using KudibaInvoicing.Domain.Ports;

namespace KudibaInvoicing.Application.Queries.ValidateSeriesSequence;

public record ValidateSeriesSequenceQuery(
    string TenantId,
    string SeriesCode,
    long ExpectedSequence,
    int DocumentYear
) : IRequest<ValidateSeriesSequenceResultDto>;

public record ValidateSeriesSequenceResultDto(
    bool IsValid,
    long LastRecordedSequence,
    string LastDocumentHash,
    bool IsGapDetected
);

public class ValidateSeriesSequenceQueryHandler : IRequestHandler<ValidateSeriesSequenceQuery, ValidateSeriesSequenceResultDto>
{
    private readonly IFiscalSeriesRepository _seriesRepository;

    public ValidateSeriesSequenceQueryHandler(IFiscalSeriesRepository seriesRepository)
    {
        _seriesRepository = seriesRepository;
    }

    public async Task<ValidateSeriesSequenceResultDto> Handle(ValidateSeriesSequenceQuery request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.TenantId, out var tenantGuid))
        {
            return new ValidateSeriesSequenceResultDto(false, 0, string.Empty, true);
        }

        // Default to "FT" if not specified
        var series = await _seriesRepository.GetByCodeAsync(
            tenantGuid,
            "FT",
            request.SeriesCode,
            request.DocumentYear,
            cancellationToken);

        if (series == null)
        {
            // Series doesn't exist yet, so sequence 1 is valid
            bool isFirst = request.ExpectedSequence == 1;
            return new ValidateSeriesSequenceResultDto(isFirst, 0, string.Empty, !isFirst);
        }

        long expected = series.CurrentSequence + 1;
        bool isNext = request.ExpectedSequence == expected;
        bool gap = request.ExpectedSequence > expected;

        return new ValidateSeriesSequenceResultDto(
            isNext,
            series.CurrentSequence,
            series.LastHash,
            gap
        );
    }
}
