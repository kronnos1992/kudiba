using Dapper;
using KudibaInvoicing.Domain.Entities;
using KudibaInvoicing.Domain.Ports;

namespace KudibaInvoicing.Infrastructure.Persistence;

public class PostgreSqlFiscalSeriesRepository : IFiscalSeriesRepository
{
    private readonly IUnitOfWork _unitOfWork;

    public PostgreSqlFiscalSeriesRepository(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<FiscalSeries?> GetAndLockAsync(Guid tenantId, string documentType, string seriesCode, int fiscalYear, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT id, tenant_id AS TenantId, document_type AS DocumentType,
                   series_code AS SeriesCode, fiscal_year AS FiscalYear,
                   current_sequence AS CurrentSequence, last_hash AS LastHash,
                   is_active AS IsActive, created_at AS CreatedAt
            FROM kudiba_core.series_fiscais
            WHERE tenant_id = @TenantId
              AND document_type = @DocumentType
              AND series_code = @SeriesCode
              AND fiscal_year = @FiscalYear
            FOR UPDATE;";

        var command = new CommandDefinition(
            sql,
            new
            {
                TenantId = tenantId,
                DocumentType = documentType.ToUpperInvariant(),
                SeriesCode = seriesCode.ToUpperInvariant(),
                FiscalYear = fiscalYear
            },
            transaction: _unitOfWork.Transaction,
            cancellationToken: cancellationToken
        );

        return await _unitOfWork.Connection.QuerySingleOrDefaultAsync<FiscalSeries>(command);
    }

    public async Task<FiscalSeries?> GetByCodeAsync(Guid tenantId, string documentType, string seriesCode, int fiscalYear, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT id, tenant_id AS TenantId, document_type AS DocumentType,
                   series_code AS SeriesCode, fiscal_year AS FiscalYear,
                   current_sequence AS CurrentSequence, last_hash AS LastHash,
                   is_active AS IsActive, created_at AS CreatedAt
            FROM kudiba_core.series_fiscais
            WHERE tenant_id = @TenantId
              AND document_type = @DocumentType
              AND series_code = @SeriesCode
              AND fiscal_year = @FiscalYear;";

        var command = new CommandDefinition(
            sql,
            new
            {
                TenantId = tenantId,
                DocumentType = documentType.ToUpperInvariant(),
                SeriesCode = seriesCode.ToUpperInvariant(),
                FiscalYear = fiscalYear
            },
            transaction: _unitOfWork.Transaction,
            cancellationToken: cancellationToken
        );

        return await _unitOfWork.Connection.QuerySingleOrDefaultAsync<FiscalSeries>(command);
    }

    public async Task CreateAsync(FiscalSeries series, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            INSERT INTO kudiba_core.series_fiscais (
                id, tenant_id, document_type, series_code, fiscal_year,
                current_sequence, last_hash, is_active, created_at
            ) VALUES (
                @Id, @TenantId, @DocumentType, @SeriesCode, @FiscalYear,
                @CurrentSequence, @LastHash, @IsActive, @CreatedAt
            );";

        var command = new CommandDefinition(
            sql,
            new
            {
                series.Id,
                series.TenantId,
                series.DocumentType,
                series.SeriesCode,
                series.FiscalYear,
                series.CurrentSequence,
                series.LastHash,
                series.IsActive,
                series.CreatedAt
            },
            transaction: _unitOfWork.Transaction,
            cancellationToken: cancellationToken
        );

        await _unitOfWork.Connection.ExecuteAsync(command);
    }

    public async Task UpdateSequenceAndHashAsync(Guid seriesId, long newSequence, string newHash, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            UPDATE kudiba_core.series_fiscais
            SET current_sequence = @NewSequence,
                last_hash = @NewHash
            WHERE id = @SeriesId;";

        var command = new CommandDefinition(
            sql,
            new
            {
                SeriesId = seriesId,
                NewSequence = newSequence,
                NewHash = newHash
            },
            transaction: _unitOfWork.Transaction,
            cancellationToken: cancellationToken
        );

        await _unitOfWork.Connection.ExecuteAsync(command);
    }
}
