using MediatR;
using KudibaInvoicing.Domain.Entities;
using KudibaInvoicing.Domain.Ports;

namespace KudibaInvoicing.Application.Commands.CreateFiscalSeries;

public record CreateFiscalSeriesCommand(
    Guid TenantId,
    string DocumentType,
    string SeriesCode,
    int FiscalYear
) : IRequest<Guid>;

public class CreateFiscalSeriesCommandHandler : IRequestHandler<CreateFiscalSeriesCommand, Guid>
{
    private readonly IFiscalSeriesRepository _seriesRepository;

    public CreateFiscalSeriesCommandHandler(IFiscalSeriesRepository seriesRepository)
    {
        _seriesRepository = seriesRepository;
    }

    public async Task<Guid> Handle(CreateFiscalSeriesCommand request, CancellationToken cancellationToken)
    {
        var existing = await _seriesRepository.GetByCodeAsync(
            request.TenantId,
            request.DocumentType,
            request.SeriesCode,
            request.FiscalYear,
            cancellationToken);

        if (existing != null)
            return existing.Id;

        var series = new FiscalSeries(
            Guid.NewGuid(),
            request.TenantId,
            request.DocumentType,
            request.SeriesCode,
            request.FiscalYear
        );

        await _seriesRepository.CreateAsync(series, cancellationToken);
        return series.Id;
    }
}
