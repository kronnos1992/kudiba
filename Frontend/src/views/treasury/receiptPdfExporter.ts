import { TreasuryReceipt } from '../../api/treasury';

export interface ReceiptCompanyMeta {
  name: string;
  nif: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
}

const fmtKz = (val: number | string): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return (
    new Intl.NumberFormat('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num || 0) + ' Kz'
  );
};

export const generateReceiptHtml = (
  receipt: TreasuryReceipt,
  company: ReceiptCompanyMeta
): string => {
  const totalNum = typeof receipt.total_amount === 'string' ? parseFloat(receipt.total_amount) : receipt.total_amount;
  const issuedDate = new Date(receipt.issued_at || receipt.created_at);
  const formattedDate = issuedDate.toLocaleDateString('pt-AO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const formattedTime = issuedDate.toLocaleTimeString('pt-AO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines = receipt.lines && receipt.lines.length > 0
    ? receipt.lines
    : [
        {
          id: '1',
          receipt_id: receipt.id,
          invoice_id: '',
          invoice_number: 'Quitação Global / Diversos',
          amount_settled: receipt.total_amount,
          notes: receipt.notes || 'Liquidação de conta corrente',
          created_at: receipt.created_at,
        },
      ];

  const paymentMethodLabel = (() => {
    switch (receipt.payment_method) {
      case 'TRANSFERENCIA':
        return 'Transferência Bancária';
      case 'MULTICAIXA':
        return 'Multicaixa / TPA';
      case 'NUMERARIO':
        return 'Numerário (Dinheiro)';
      case 'GPO_REFERENCE':
        return 'Referência Multicaixa (GPO/Pagamento por Referência)';
      default:
        return receipt.payment_method;
    }
  })();

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>Recibo ${receipt.receipt_number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 18mm 15mm 18mm;
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
      font-size: 11pt;
      line-height: 1.4;
      color: #1e293b;
      background: #ffffff;
      padding: 20px;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .company-col {
      max-width: 55%;
    }
    .company-name {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      text-transform: uppercase;
    }
    .company-meta {
      font-size: 9.5pt;
      color: #475569;
      margin-top: 4px;
    }
    .company-nif {
      font-weight: 700;
      color: #0f172a;
    }
    .doc-col {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #ecfdf5;
      color: #047857;
      border: 1.5px solid #059669;
      font-size: 13pt;
      font-weight: 800;
      padding: 4px 14px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .doc-number {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      font-family: 'Consolas', monospace;
      margin-top: 6px;
    }
    .doc-date {
      font-size: 9.5pt;
      color: #64748b;
      margin-top: 2px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .card-title {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 8px;
    }
    .card-content {
      font-size: 10pt;
      color: #1e293b;
    }
    .card-content strong {
      color: #0f172a;
    }
    .table-container {
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5pt;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      text-align: left;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    td {
      padding: 9px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .font-mono {
      font-family: 'Consolas', monospace;
    }
    .total-box {
      margin-left: auto;
      width: 320px;
      border: 1.5px solid #059669;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      font-size: 10pt;
      border-bottom: 1px solid #e2e8f0;
    }
    .total-row.highlight {
      background: #059669;
      color: #ffffff;
      font-size: 13pt;
      font-weight: 800;
      border-bottom: none;
    }
    .legal-notice {
      background: #f1f5f9;
      border-left: 3px solid #059669;
      padding: 10px 14px;
      font-size: 8pt;
      color: #475569;
      margin-bottom: 28px;
      border-radius: 0 6px 6px 0;
    }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 40px;
      text-align: center;
    }
    .signature-line {
      border-top: 1px solid #94a3b8;
      padding-top: 6px;
      font-size: 9pt;
      color: #475569;
      font-weight: 600;
    }
    .footer {
      margin-top: 35px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 7.5pt;
      color: #94a3b8;
      text-align: center;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="company-col">
      <div class="company-name">${company.name}</div>
      <div class="company-meta">
        <div>NIF: <span class="company-nif">${company.nif}</span></div>
        ${company.address ? `<div>${company.address}</div>` : ''}
        ${company.city ? `<div>${company.city} · Angola</div>` : '<div>Angola</div>'}
        ${company.phone ? `<div>Tel: ${company.phone}</div>` : ''}
      </div>
    </div>
    <div class="doc-col">
      <div class="doc-badge">RECIBO DE QUITAÇÃO</div>
      <div class="doc-number">${receipt.receipt_number}</div>
      <div class="doc-date">Data: ${formattedDate} às ${formattedTime}</div>
      <div class="doc-date">Moeda: <strong>${receipt.currency || 'AOA'}</strong></div>
    </div>
  </div>

  <div class="info-grid">
    <div class="card">
      <div class="card-title">Adquirente / Cliente</div>
      <div class="card-content">
        <div style="font-size: 11pt; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
          ${receipt.customer_name || 'Consumidor Final'}
        </div>
        <div>NIF: <strong class="font-mono">${receipt.customer_nif || '999999999'}</strong></div>
        <div style="color: #64748b; font-size: 9pt; margin-top: 4px;">Conta Corrente / Liquidação</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Dados do Pagamento</div>
      <div class="card-content">
        <div>Meio Utilizado: <strong>${paymentMethodLabel}</strong></div>
        ${receipt.bank_account_id ? `<div>Conta Bancária: <span class="font-mono" style="font-size: 9pt;">${receipt.bank_account_id}</span></div>` : ''}
        ${receipt.session_id ? `<div>Sessão de Caixa: <span class="font-mono" style="font-size: 9pt;">${receipt.session_id}</span></div>` : ''}
        ${receipt.notes ? `<div style="margin-top: 4px; font-style: italic; color: #475569;">Ref: ${receipt.notes}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">#</th>
          <th style="width: 30%;">Documento Fiscal / Fatura</th>
          <th style="width: 40%;">Anotações / Descrição da Quitação</th>
          <th style="width: 25%;" class="text-right">Montante Liquidado</th>
        </tr>
      </thead>
      <tbody>
        ${lines
          .map(
            (l, idx) => `
          <tr>
            <td style="color: #94a3b8;">${idx + 1}</td>
            <td class="font-mono" style="font-weight: 700; color: #0f172a;">${l.invoice_number || 'FT s/n'}</td>
            <td style="color: #475569;">${l.notes || (totalNum ? 'Quitação parcial / regularização' : 'Liquidação de fatura')}</td>
            <td class="text-right font-mono" style="font-weight: 700; color: #047857;">${fmtKz(l.amount_settled)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="total-box">
    <div class="total-row">
      <span>Subtotal Liquidado:</span>
      <span class="font-mono">${fmtKz(totalNum)}</span>
    </div>
    <div class="total-row">
      <span>Imposto Retido na Fonte:</span>
      <span class="font-mono">0,00 Kz</span>
    </div>
    <div class="total-row highlight">
      <span>TOTAL QUITADO:</span>
      <span class="font-mono">${fmtKz(totalNum)}</span>
    </div>
  </div>

  <div class="legal-notice">
    <strong>Quitação e Menção Legal (Decreto Presidencial n.º 71/25 e PGC Angola):</strong><br>
    Damos quitação dos valores discriminados no presente recibo. Este documento não serve de fatura mas comprova a boa liquidação do valor nele constante.
    Os bens ou serviços associados foram faturados nos termos do Regime Jurídico das Faturas e Documentos Equivalentes.
  </div>

  <div class="signatures-grid">
    <div>
      <div class="signature-line">O Adquirente / Cliente</div>
    </div>
    <div>
      <div class="signature-line">Por ${company.name} (Assinatura Autorizada)</div>
    </div>
  </div>

  <div class="footer">
    <span>Kudiba ERP — Sistema de Gestão Empresarial Integrada</span>
    <span>Software Certificado AGT · Documento Processado por Computador</span>
    <span>ID: ${receipt.id}</span>
  </div>
</body>
</html>`;
};

export const printReceiptPdf = (
  receipt: TreasuryReceipt,
  company: ReceiptCompanyMeta
) => {
  const html = generateReceiptHtml(receipt, company);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita popups para imprimir o recibo.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
};

export const downloadReceiptPdfFile = (
  receipt: TreasuryReceipt,
  company: ReceiptCompanyMeta
) => {
  const html = generateReceiptHtml(receipt, company);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Recibo_${receipt.receipt_number.replace(/\//g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
