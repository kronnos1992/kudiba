using Dapper;
using KudibaInvoicing.Domain.Entities;
using KudibaInvoicing.Domain.Ports;

namespace KudibaInvoicing.Infrastructure.Persistence;

public class PostgreSqlInvoiceRepository : IInvoiceRepository
{
    private readonly IUnitOfWork _unitOfWork;

    public PostgreSqlInvoiceRepository(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task SaveAsync(Invoice invoice, CancellationToken cancellationToken = default)
    {
        const string insertInvoiceSql = @"
            INSERT INTO kudiba_core.invoices (
                id, tenant_id, series_id, document_number, sequence_number,
                document_type, customer_name, customer_nif, currency,
                net_total, tax_total, gross_total, hash_sha256,
                signature_rsa_base64, validation_chars, key_version,
                is_contingency, issued_at, system_entry_date, created_at
            ) VALUES (
                @Id, @TenantId, @SeriesId, @DocumentNumber, @SequenceNumber,
                @DocumentType, @CustomerName, @CustomerNif, @Currency,
                @NetTotal, @TaxTotal, @GrossTotal, @HashSha256,
                @SignatureRsaBase64, @ValidationChars, @KeyVersion,
                @IsContingency, @IssuedAt, @SystemEntryDate, @CreatedAt
            );";

        var invoiceCmd = new CommandDefinition(
            insertInvoiceSql,
            new
            {
                invoice.Id,
                invoice.TenantId,
                invoice.SeriesId,
                invoice.DocumentNumber,
                invoice.SequenceNumber,
                invoice.DocumentType,
                invoice.CustomerName,
                invoice.CustomerNif,
                invoice.Currency,
                invoice.NetTotal,
                invoice.TaxTotal,
                invoice.GrossTotal,
                invoice.HashSha256,
                invoice.SignatureRsaBase64,
                invoice.ValidationChars,
                invoice.KeyVersion,
                invoice.IsContingency,
                invoice.IssuedAt,
                invoice.SystemEntryDate,
                invoice.CreatedAt
            },
            transaction: _unitOfWork.Transaction,
            cancellationToken: cancellationToken
        );

        await _unitOfWork.Connection.ExecuteAsync(invoiceCmd);

        const string insertLineSql = @"
            INSERT INTO kudiba_core.invoice_lines (
                id, invoice_id, line_number, product_code, description,
                quantity, unit_price, tax_rate, tax_exemption_code, line_total
            ) VALUES (
                @Id, @InvoiceId, @LineNumber, @ProductCode, @Description,
                @Quantity, @UnitPrice, @TaxRate, @TaxExemptionCode, @LineTotal
            );";

        foreach (var line in invoice.Lines)
        {
            var lineCmd = new CommandDefinition(
                insertLineSql,
                new
                {
                    line.Id,
                    line.InvoiceId,
                    line.LineNumber,
                    line.ProductCode,
                    line.Description,
                    line.Quantity,
                    line.UnitPrice,
                    line.TaxRate,
                    line.TaxExemptionCode,
                    line.LineTotal
                },
                transaction: _unitOfWork.Transaction,
                cancellationToken: cancellationToken
            );

            await _unitOfWork.Connection.ExecuteAsync(lineCmd);
        }
    }

    public async Task<Invoice?> GetByDocumentNumberAsync(Guid tenantId, string documentNumber, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT id, tenant_id AS TenantId, series_id AS SeriesId,
                   document_number AS DocumentNumber, sequence_number AS SequenceNumber,
                   document_type AS DocumentType, customer_name AS CustomerName,
                   customer_nif AS CustomerNif, currency AS Currency,
                   net_total AS NetTotal, tax_total AS TaxTotal, gross_total AS GrossTotal,
                   hash_sha256 AS HashSha256, signature_rsa_base64 AS SignatureRsaBase64,
                   validation_chars AS ValidationChars, key_version AS KeyVersion,
                   is_contingency AS IsContingency, issued_at AS IssuedAt,
                   system_entry_date AS SystemEntryDate, created_at AS CreatedAt
            FROM kudiba_core.invoices
            WHERE tenant_id = @TenantId AND document_number = @DocumentNumber;";

        var invoice = await _unitOfWork.Connection.QuerySingleOrDefaultAsync<Invoice>(
            new CommandDefinition(sql, new { TenantId = tenantId, DocumentNumber = documentNumber }, cancellationToken: cancellationToken)
        );

        if (invoice != null)
        {
            const string linesSql = @"
                SELECT id, invoice_id AS InvoiceId, line_number AS LineNumber,
                       product_code AS ProductCode, description AS Description,
                       quantity AS Quantity, unit_price AS UnitPrice,
                       tax_rate AS TaxRate, tax_exemption_code AS TaxExemptionCode,
                       line_total AS LineTotal
                FROM kudiba_core.invoice_lines
                WHERE invoice_id = @InvoiceId
                ORDER BY line_number ASC;";

            var lines = await _unitOfWork.Connection.QueryAsync<InvoiceLine>(
                new CommandDefinition(linesSql, new { InvoiceId = invoice.Id }, cancellationToken: cancellationToken)
            );

            invoice.Lines.AddRange(lines);
        }

        return invoice;
    }

    public async Task<Invoice?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        const string sql = @"
            SELECT id, tenant_id AS TenantId, series_id AS SeriesId,
                   document_number AS DocumentNumber, sequence_number AS SequenceNumber,
                   document_type AS DocumentType, customer_name AS CustomerName,
                   customer_nif AS CustomerNif, currency AS Currency,
                   net_total AS NetTotal, tax_total AS TaxTotal, gross_total AS GrossTotal,
                   hash_sha256 AS HashSha256, signature_rsa_base64 AS SignatureRsaBase64,
                   validation_chars AS ValidationChars, key_version AS KeyVersion,
                   is_contingency AS IsContingency, issued_at AS IssuedAt,
                   system_entry_date AS SystemEntryDate, created_at AS CreatedAt
            FROM kudiba_core.invoices
            WHERE id = @Id;";

        var invoice = await _unitOfWork.Connection.QuerySingleOrDefaultAsync<Invoice>(
            new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)
        );

        if (invoice != null)
        {
            const string linesSql = @"
                SELECT id, invoice_id AS InvoiceId, line_number AS LineNumber,
                       product_code AS ProductCode, description AS Description,
                       quantity AS Quantity, unit_price AS UnitPrice,
                       tax_rate AS TaxRate, tax_exemption_code AS TaxExemptionCode,
                       line_total AS LineTotal
                FROM kudiba_core.invoice_lines
                WHERE invoice_id = @InvoiceId
                ORDER BY line_number ASC;";

            var lines = await _unitOfWork.Connection.QueryAsync<InvoiceLine>(
                new CommandDefinition(linesSql, new { InvoiceId = invoice.Id }, cancellationToken: cancellationToken)
            );

            invoice.Lines.AddRange(lines);
        }

        return invoice;
    }
}
