using MediatR;
using KudibaInvoicing.Domain.Entities;
using KudibaInvoicing.Domain.Ports;
using KudibaInvoicing.Domain.ValueObjects;

namespace KudibaInvoicing.Application.Commands.IssueInvoice;

public class IssueInvoiceCommandHandler : IRequestHandler<IssueInvoiceCommand, IssueInvoiceResultDto>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFiscalSeriesRepository _seriesRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IRsaCryptoSigner _cryptoSigner;

    public IssueInvoiceCommandHandler(
        IUnitOfWork unitOfWork,
        IFiscalSeriesRepository seriesRepository,
        IInvoiceRepository invoiceRepository,
        IRsaCryptoSigner cryptoSigner)
    {
        _unitOfWork = unitOfWork;
        _seriesRepository = seriesRepository;
        _invoiceRepository = invoiceRepository;
        _cryptoSigner = cryptoSigner;
    }

    public async Task<IssueInvoiceResultDto> Handle(IssueInvoiceCommand request, CancellationToken cancellationToken)
    {
        if (request.Lines == null || request.Lines.Count == 0)
            throw new ArgumentException("Invoice must have at least one line item.", nameof(request.Lines));

        await _unitOfWork.BeginTransactionAsync(cancellationToken);

        try
        {
            // 1. Lock series with SELECT ... FOR UPDATE to serialize concurrent requests
            var series = await _seriesRepository.GetAndLockAsync(
                request.TenantId,
                request.DocumentType,
                request.SeriesCode,
                request.FiscalYear,
                cancellationToken);

            if (series == null)
            {
                series = new FiscalSeries(
                    Guid.NewGuid(),
                    request.TenantId,
                    request.DocumentType,
                    request.SeriesCode,
                    request.FiscalYear
                );
                await _seriesRepository.CreateAsync(series, cancellationToken);
            }

            // 2. Next sequential number
            long newSequence = series.NextSequence();
            string docNumber = series.FormatDocumentNumber(newSequence);

            // 3. Compute totals using exact 128-bit decimal arithmetic
            decimal netTotal = 0m;
            decimal taxTotal = 0m;
            var invoiceId = Guid.NewGuid();
            var invoiceLines = new List<InvoiceLine>();

            int lineIndex = 1;
            foreach (var l in request.Lines)
            {
                decimal lineBase = Math.Round(l.Quantity * l.UnitPrice, 2, MidpointRounding.AwayFromZero);
                decimal lineTax = Math.Round(lineBase * (l.TaxRate / 100m), 2, MidpointRounding.AwayFromZero);
                decimal lineGross = lineBase + lineTax;

                netTotal += lineBase;
                taxTotal += lineTax;

                invoiceLines.Add(new InvoiceLine(
                    Guid.NewGuid(),
                    invoiceId,
                    lineIndex++,
                    l.ProductCode,
                    l.Description,
                    l.Quantity,
                    l.UnitPrice,
                    l.TaxRate,
                    l.TaxExemptionCode,
                    lineGross
                ));
            }

            decimal grossTotal = netTotal + taxTotal;

            // 4. Timestamps
            DateTime now = DateTime.UtcNow;
            DateTime invoiceDate = now.Date;
            DateTime systemEntryDate = now;

            // 5. Build Canonical AGT Buffer & Sign with RSA-2048 PKCS#1 v1.5
            string canonicalBuffer = CanonicalBufferBuilder.Build(
                invoiceDate,
                systemEntryDate,
                docNumber,
                grossTotal,
                series.LastHash
            );

            var signResult = _cryptoSigner.SignCanonicalBuffer(canonicalBuffer);

            // 6. Build immutable Invoice Aggregate
            var invoice = new Invoice(
                invoiceId,
                request.TenantId,
                series.Id,
                docNumber,
                newSequence,
                request.DocumentType,
                request.CustomerName,
                request.CustomerNif,
                request.Currency,
                netTotal,
                taxTotal,
                grossTotal,
                signResult.HashSha256,
                signResult.SignatureBase64,
                signResult.ValidationChars,
                request.KeyVersion,
                request.IsContingency,
                invoiceDate,
                systemEntryDate,
                invoiceLines
            );

            // 7. Persist Invoice & Lines within UOW
            await _invoiceRepository.SaveAsync(invoice, cancellationToken);

            // 8. Update Series sequence and chained hash
            series.AdvanceSequence(signResult.HashSha256);
            await _seriesRepository.UpdateSequenceAndHashAsync(series.Id, series.CurrentSequence, series.LastHash, cancellationToken);

            // 9. Commit atomic transaction
            await _unitOfWork.CommitAsync(cancellationToken);

            return new IssueInvoiceResultDto(
                invoice.Id,
                invoice.DocumentNumber,
                invoice.SequenceNumber,
                invoice.NetTotal,
                invoice.TaxTotal,
                invoice.GrossTotal,
                invoice.HashSha256,
                invoice.SignatureRsaBase64,
                invoice.ValidationChars,
                invoice.IssuedAt,
                invoice.SystemEntryDate,
                invoice.IsContingency
            );
        }
        catch
        {
            await _unitOfWork.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
