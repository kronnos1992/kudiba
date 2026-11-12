import { Proforma } from '../../api/invoicing';
import { Tenant } from '../../types/auth';

const fmtKz = (val: number | null | undefined): string => {
  return (
    new Intl.NumberFormat('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0) + ' Kz'
  );
};

export const exportProformaPdf = (
  proforma: Proforma,
  tenant: Tenant | null | undefined
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const companyName =
    tenant?.trade_name || tenant?.company_name || tenant?.name || 'KUDIBA COMÉRCIO GERAL, LDA';
  const legalName =
    tenant?.company_name && tenant.company_name !== companyName
      ? tenant.company_name
      : tenant?.name && tenant.name !== companyName
      ? tenant.name
      : null;
  const addressDetail = tenant?.address_detail || 'Luanda — Angola';
  const cityProvince = [tenant?.city || 'Luanda', tenant?.province, tenant?.country === 'AO' || !tenant?.country ? 'Angola' : tenant.country]
    .filter(Boolean)
    .join(' — ');
  const nif = tenant?.nif || tenant?.taxId || '5000000000';
  const contacts = [tenant?.phone, tenant?.email, tenant?.website].filter(Boolean).join(' • ');

  // VAT group calculation
  const vatGroups: Record<number, { base: number; tax: number; exemption?: string }> = {};
  for (const line of proforma.lines || []) {
    const net = line.quantity * line.unitPrice - (line.discountAmount || 0);
    const tax = net * ((line.taxRate || 0) / 100);
    if (!vatGroups[line.taxRate || 0]) {
      vatGroups[line.taxRate || 0] = {
        base: 0,
        tax: 0,
        exemption: line.taxExemptionCode || (line.taxRate === 0 ? 'M02' : undefined),
      };
    }
    vatGroups[line.taxRate || 0].base += net;
    vatGroups[line.taxRate || 0].tax += tax;
  }

  // Bank accounts
  const bankAccounts = tenant?.bank_accounts && tenant.bank_accounts.length > 0
    ? tenant.bank_accounts
    : [
        {
          bank_name: 'Banco BAI',
          account_number: '123456789',
          iban: 'AO06 0040 0000 1234 5678 9012 3',
        },
      ];

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Factura Proforma ${proforma.documentNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
      color: #0f172a;
      background: #ffffff;
      padding: 10px;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .company-title {
      font-size: 13pt;
      font-weight: 800;
      color: #065f46;
      text-transform: uppercase;
      letter-spacing: -0.2px;
      line-height: 1.15;
    }
    .company-sub {
      font-size: 7.8pt;
      color: #475569;
      margin-top: 2px;
    }
    .doc-box {
      text-align: right;
      vertical-align: top;
    }
    .doc-type {
      font-size: 8.5pt;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .doc-number {
      font-size: 13pt;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0;
      font-family: Consolas, monospace;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-proforma {
      background: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .badge-nonfiscal {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .divider {
      border-top: 1.5px solid #e2e8f0;
      margin: 10px 0 14px 0;
    }
    .party-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .party-box {
      width: 50%;
      vertical-align: top;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
    }
    .party-title {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .party-name {
      font-size: 9pt;
      font-weight: 800;
      color: #0f172a;
    }
    .party-detail {
      font-size: 7.8pt;
      color: #334155;
      margin-top: 2px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 8px;
      border: 1px solid #0f172a;
    }
    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      font-size: 8.2pt;
    }
    .items-table tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-mono { font-family: Consolas, monospace; }
    .summary-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }
    .summary-left {
      width: 55%;
      vertical-align: top;
      padding-right: 14px;
    }
    .summary-right {
      width: 45%;
      vertical-align: top;
    }
    .vat-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .vat-table th {
      background: #f1f5f9;
      color: #334155;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 4px 6px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    .vat-table td {
      padding: 4px 6px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 7.8pt;
    }
    .totals-box {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 8.2pt;
      color: #334155;
      margin-bottom: 4px;
    }
    .totals-grand {
      border-top: 1.5px solid #0f172a;
      padding-top: 6px;
      margin-top: 6px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .totals-grand-label {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
    }
    .totals-grand-value {
      font-size: 12pt;
      font-weight: 900;
      color: #047857;
      font-family: Consolas, monospace;
    }
    .iban-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 5px;
      padding: 6px 10px;
      font-size: 7.5pt;
      color: #166534;
      margin-bottom: 10px;
    }
    .footer-legal {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 16px;
      font-size: 6.8pt;
      color: #64748b;
      line-height: 1.4;
      text-align: center;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 58%; vertical-align: top;">
        ${tenant?.logo_data_url ? `<img src="${tenant.logo_data_url}" alt="Logo" style="max-height: 38px; max-width: 120px; object-fit: contain; margin-bottom: 4px; display: block;" />` : ''}
        <div class="company-title">${companyName}</div>
        ${legalName ? `<div style="font-size: 7.8pt; font-weight: 600; color: #334155;">${legalName}</div>` : ''}
        <div class="company-sub">
          ${addressDetail}<br/>
          ${cityProvince}<br/>
          NIF: <strong>${nif}</strong>${tenant?.commercial_registry ? ` &nbsp;·&nbsp; Reg. Com.: ${tenant.commercial_registry}` : ''}${tenant?.share_capital ? ` &nbsp;·&nbsp; Capital Social: ${tenant.share_capital}` : ''}<br/>
          ${contacts ? `Contactos: ${contacts}` : ''}
        </div>
      </td>
      <td class="doc-box" style="width: 42%;">
        <div class="doc-type">FACTURA PROFORMA</div>
        <div class="doc-number">${proforma.documentNumber}</div>
        <div class="company-sub" style="margin-bottom: 5px;">
          Data de Emissão: ${new Date(proforma.createdAt).toLocaleDateString('pt-AO')}
        </div>
        <div>
          <span class="badge badge-proforma">PROFORMA</span>
          <span class="badge badge-nonfiscal">DOCUMENTO NÃO FISCAL</span>
        </div>
      </td>
    </tr>
  </table>

  <div class="divider"></div>

  <table class="party-grid">
    <tr>
      <td class="party-box" style="border-right: none; border-top-right-radius: 0; border-bottom-right-radius: 0;">
        <div class="party-title">Exmo.(s) Sr.(s) / Adquirente</div>
        <div class="party-name">${proforma.customerName}</div>
        <div class="party-detail">NIF: <strong>${proforma.customerNif || 'Consumidor Final'}</strong></div>
        ${proforma.customerAddress ? `<div class="party-detail">${proforma.customerAddress}</div>` : ''}
        ${proforma.customerCity || proforma.customerCountry ? `<div class="party-detail">${[proforma.customerCity, proforma.customerCountry].filter(Boolean).join(' — ')}</div>` : ''}
      </td>
      <td class="party-box" style="border-top-left-radius: 0; border-bottom-left-radius: 0;">
        <div class="party-title">Dados da Operação Comercial</div>
        <div class="party-detail">Moeda: <strong>${proforma.currency || 'Kwanzas (AOA)'}</strong></div>
        <div class="party-detail">Estado: <strong>${proforma.status === 'CONVERTED' ? 'Convertida em Factura' : proforma.status === 'CONVERTING' ? 'A Converter' : 'Aberta / Aguarda Adjudicação'}</strong></div>
        <div class="party-detail">Validade da Proposta: <strong>30 dias a contar da emissão</strong></div>
        <div class="party-detail">Condições de Pagamento: <strong>Pronto Pagamento / Transferência</strong></div>
      </td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 6%;" class="text-center">N.º</th>
        <th style="width: 14%;">Código</th>
        <th style="width: 42%;">Designação do Artigo / Serviço</th>
        <th style="width: 8%;" class="text-center">Qtd</th>
        <th style="width: 15%;" class="text-right">Preço Unit.</th>
        <th style="width: 15%;" class="text-right">Total Líquido</th>
      </tr>
    </thead>
    <tbody>
      ${(proforma.lines || []).map((line, i) => {
        const net = line.quantity * line.unitPrice - (line.discountAmount || 0);
        const lineTotal = line.lineTotal || (net * (1 + (line.taxRate || 0) / 100));
        return `
          <tr>
            <td class="text-center font-mono">${String(i + 1).padStart(2, '0')}</td>
            <td class="font-mono">${line.productCode}</td>
            <td>${line.description}</td>
            <td class="text-center font-mono">${line.quantity}</td>
            <td class="text-right font-mono">${fmtKz(line.unitPrice)}</td>
            <td class="text-right font-mono"><strong>${fmtKz(lineTotal)}</strong></td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <table class="summary-grid">
    <tr>
      <td class="summary-left">
        <div class="party-title">Resumo de Impostos</div>
        <table class="vat-table">
          <thead>
            <tr>
              <th>Taxa</th>
              <th class="text-right">Incidência</th>
              <th class="text-right">Valor IVA</th>
              <th>Motivo de Isenção</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(vatGroups).map(([rate, g]) => `
              <tr>
                <td>${rate}% ${Number(rate) === 0 ? '(Isento)' : ''}</td>
                <td class="text-right font-mono">${fmtKz(g.base)}</td>
                <td class="text-right font-mono">${fmtKz(g.tax)}</td>
                <td>${g.exemption ? `${g.exemption}` : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${bankAccounts.length > 0 ? `
          <div class="iban-box">
            <strong>Coordenadas Bancárias para Liquidação (IBAN):</strong><br/>
            ${bankAccounts.map((b) => `${b.bank_name}: ${b.iban} (${companyName})`).join('<br/>')}
          </div>
        ` : ''}
      </td>
      <td class="summary-right">
        <div class="totals-box">
          <div class="totals-row">
            <span>Total Ilíquido:</span>
            <span class="font-mono">${fmtKz(proforma.netTotal)}</span>
          </div>
          <div class="totals-row">
            <span>Descontos Comerciais:</span>
            <span class="font-mono">${fmtKz(0)}</span>
          </div>
          <div class="totals-row">
            <span>Imposto sobre o Valor Acrescentado (IVA):</span>
            <span class="font-mono">${fmtKz(proforma.taxTotal)}</span>
          </div>
          <div class="totals-grand">
            <span class="totals-grand-label">TOTAL PROFORMA:</span>
            <span class="totals-grand-value">${fmtKz(proforma.grossTotal)}</span>
          </div>
        </div>
      </td>
    </tr>
  </table>

  <div class="footer-legal">
    Os valores e disponibilidade de stock constantes desta Proforma estão sujeitos a confirmação no acto da emissão da respectiva Factura definitiva.<br/>
    <strong>Documento emitido exclusivamente para efeitos de cotação e adjudicação comercial. Não possui valor fiscal nem confere direito à dedução de IVA ou quitação nos termos do RJFDE (Dec. Presidencial n.º 71/25).</strong><br/>
    Processado por programa validado n.º FE/528/AGT/2026 · Kudiba ERP
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
};
