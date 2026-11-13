import { Branch, Tenant } from '../types/auth';

export interface ReportCompanyMeta {
  companyName: string;
  tradeName?: string;
  companyDescription?: string;
  logoDataUrl?: string | null;
  nif: string;
  address?: string;
  contacts?: string;
  commercialRegistry?: string;
  shareCapital?: string;
  taxRegime?: string;
  agtCertNumber?: string;
  branchName?: string;
  periodLabel: string;
  normativeRef?: string;
  currency?: string;
  documentCode?: string;
}

export const buildCompanyReportMeta = (
  tenant: Tenant | null | undefined,
  branch: Branch | null | undefined,
  periodLabel: string = `Posição em ${new Date().toLocaleDateString('pt-AO')}`,
  normativeRef?: string
): ReportCompanyMeta => {
  const companyName =
    tenant?.company_name || tenant?.name || tenant?.trade_name || 'Kudiba Enterprise Lda';
  const tradeName =
    tenant?.trade_name && tenant.trade_name !== companyName ? tenant.trade_name : undefined;
  const nif = tenant?.nif || tenant?.taxId || '5412345678';

  const addressParts = [
    tenant?.address_detail,
    tenant?.city || 'Luanda',
    tenant?.province && tenant.province !== tenant?.city ? `(${tenant.province})` : null,
    'Angola',
  ].filter(Boolean);
  const address = addressParts.join(', ');

  const contactParts = [tenant?.phone, tenant?.email, tenant?.website].filter(Boolean);
  const contacts = contactParts.join(' • ');

  const taxRegime = tenant?.tax_regime_code
    ? tenant.tax_regime_code.replace(/_/g, ' ')
    : 'Regime Geral de Tributação (AGT)';

  const descParts = [
    tenant?.commercial_registry ? `Registo Comercial: ${tenant.commercial_registry}` : null,
    tenant?.alvara_number ? `Alvará Comercial: ${tenant.alvara_number}` : null,
    tenant?.share_capital ? `Capital Social: ${tenant.share_capital}` : null,
    `Regime Fiscal: ${taxRegime}`,
  ].filter(Boolean);

  const companyDescription =
    descParts.length > 0
      ? descParts.join(' · ')
      : 'Sociedade Comercial de Direito Angolano · Contabilidade e Gestão Certificada';

  const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const documentCode = `REL-${nif.slice(-4)}-${dateCode}`;

  return {
    companyName,
    tradeName,
    companyDescription,
    logoDataUrl: tenant?.logo_data_url || null,
    nif,
    address,
    contacts: contacts || undefined,
    commercialRegistry: tenant?.commercial_registry || undefined,
    shareCapital: tenant?.share_capital || undefined,
    taxRegime,
    agtCertNumber: tenant?.agt_cert_number || 'FE/528/AGT/2026',
    branchName: branch?.name || 'Sede Principal',
    periodLabel,
    normativeRef:
      normativeRef || 'Normativo Contabilístico e Fiscal da República de Angola (PGC / AGT)',
    currency: tenant?.currency || 'Kwanzas (AOA)',
    documentCode,
  };
};

export type ReportTone =
  | 'default'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'info'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'purple';

export interface ReportKpiItem {
  label: string;
  value: string;
  sublabel?: string;
  tone?: ReportTone;
}

export interface ReportColumn {
  key?: string;
  label?: string;
  header?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
  mono?: boolean;
  isCurrency?: boolean;
}

export interface ReportRow {
  cells:
    | Record<string, string | number | null | undefined>
    | Array<string | number | null | undefined>;
  isSection?: boolean;
  sectionTitle?: string;
  sectionCode?: string;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isNegative?: boolean;
  highlightTone?: 'danger' | 'warning' | 'success' | 'info';
}

export type SectionThemeColor =
  | 'slate'
  | 'blue'
  | 'emerald'
  | 'sky'
  | 'purple'
  | 'amber'
  | 'rose';

export interface ReportSection {
  title: string;
  subtitle?: string;
  badgeText?: string;
  headerColor?: SectionThemeColor;
  theme?: SectionThemeColor;
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface CorporateReportDocument {
  title: string;
  subtitle?: string;
  filenameBase: string;
  orientation?: 'portrait' | 'landscape';
  meta: ReportCompanyMeta;
  kpis?: ReportKpiItem[];
  summaryNotes?: string[];
  sections: ReportSection[];
  signatures?: string[];
  footerNote?: string;
}

export const fmtKzReport = (val: number | string | null | undefined): string => {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  const safe = Number.isFinite(num) ? num : 0;
  return (
    new Intl.NumberFormat('pt-AO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe) + ' Kz'
  );
};

export const fmtReportKz = fmtKzReport;

export const fmtNumReport = (val: number | string | null | undefined): string => {
  const num = typeof val === 'string' ? parseFloat(val) : Number(val || 0);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toFixed(2).replace('.', ',');
};

export const fmtPctReport = (num: number, base: number): string => {
  if (!base || Math.abs(base) < 0.001) return '0,00%';
  return ((num / base) * 100).toFixed(2).replace('.', ',') + '%';
};

const SECTION_BG_HEX: Record<SectionThemeColor, string> = {
  slate: '#0f172a',
  blue: '#1e3a8a',
  emerald: '#065f46',
  sky: '#0369a1',
  purple: '#581c87',
  amber: '#92400e',
  rose: '#9f1239',
};

const KPI_TONE_HEX: Record<ReportTone, { text: string; border: string; bg: string }> = {
  default: { text: '#0f172a', border: '#334155', bg: '#f8fafc' },
  slate: { text: '#0f172a', border: '#475569', bg: '#f8fafc' },
  positive: { text: '#047857', border: '#059669', bg: '#ecfdf5' },
  emerald: { text: '#047857', border: '#059669', bg: '#ecfdf5' },
  negative: { text: '#b91c1c', border: '#dc2626', bg: '#fef2f2' },
  rose: { text: '#be123c', border: '#e11d48', bg: '#fff1f2' },
  warning: { text: '#b45309', border: '#d97706', bg: '#fffbeb' },
  amber: { text: '#b45309', border: '#d97706', bg: '#fffbeb' },
  info: { text: '#1d4ed8', border: '#2563eb', bg: '#eff6ff' },
  blue: { text: '#1e40af', border: '#2563eb', bg: '#eff6ff' },
  purple: { text: '#6b21a8', border: '#7c3aed', bg: '#faf5ff' },
};

export const escapeHtml = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const escapeCsvCell = (raw: string | number | null | undefined): string => {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).replace(/\r?\n/g, ' ').trim();
  if (str.includes(';') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const getColLabel = (col: ReportColumn): string => col.label || col.header || '';

const getRawCellValue = (
  row: ReportRow,
  col: ReportColumn,
  colIdx: number
): string | number | null | undefined => {
  if (Array.isArray(row.cells)) {
    return row.cells[colIdx];
  }
  if (col.key && row.cells && typeof row.cells === 'object') {
    return (row.cells as Record<string, string | number | null | undefined>)[col.key];
  }
  return '';
};

const formatCellDisplay = (
  val: string | number | null | undefined,
  col: ReportColumn,
  forCsv = false
): string => {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    if (col.isCurrency) {
      return forCsv ? fmtNumReport(val) : fmtKzReport(val);
    }
    return Number.isInteger(val) ? String(val) : fmtNumReport(val);
  }
  return String(val);
};

const getSectionTitleFromRow = (row: ReportRow): { code: string; title: string } => {
  if (row.sectionTitle) {
    return { code: row.sectionCode || '', title: row.sectionTitle };
  }
  if (Array.isArray(row.cells)) {
    const first = String(row.cells[0] ?? '').trim();
    const second = String(row.cells[1] ?? '').trim();
    if (second) {
      return { code: first, title: second };
    }
    return { code: '', title: first };
  }
  return { code: row.sectionCode || '', title: '' };
};

export const exportCorporateReportCsv = (doc: CorporateReportDocument) => {
  const nowStr = new Date().toLocaleString('pt-AO');
  const lines: string[] = [
    `================================================================================`,
    doc.title.toUpperCase(),
    ...(doc.subtitle ? [doc.subtitle] : []),
    `Normativo Aplicável:;${escapeCsvCell(doc.meta.normativeRef || 'Legislação Comercial e Fiscal da República de Angola')}`,
    `Entidade / Empresa:;${escapeCsvCell(doc.meta.companyName)}${doc.meta.tradeName ? ` (${escapeCsvCell(doc.meta.tradeName)})` : ''};NIF:;${escapeCsvCell(doc.meta.nif)}`,
    ...(doc.meta.companyDescription
      ? [`Enquadramento Societário:;${escapeCsvCell(doc.meta.companyDescription)}`]
      : []),
    `Sede / Endereço:;${escapeCsvCell(doc.meta.address || 'Luanda, Angola')};Filial / Unidade:;${escapeCsvCell(doc.meta.branchName || 'Sede Principal')}`,
    ...(doc.meta.contacts ? [`Contactos Oficiais:;${escapeCsvCell(doc.meta.contacts)}`] : []),
    `Período de Relato:;${escapeCsvCell(doc.meta.periodLabel)};Moeda de Apresentação:;${escapeCsvCell(doc.meta.currency || 'Kwanzas (AOA)')}`,
    `Ref. Documental:;${escapeCsvCell(doc.meta.documentCode || 'REL-OFICIAL')};Data e Hora de Emissão:;${nowStr}`,
    `================================================================================`,
    '',
  ];

  if (doc.kpis && doc.kpis.length > 0) {
    lines.push('=== QUADRO DE INDICADORES EXECUTIVOS DE GESTÃO (KPIs) ===');
    lines.push('Indicador Executivo;Valor Apurado;Contexto / Detalhe Analítico');
    for (const kpi of doc.kpis) {
      lines.push(
        `${escapeCsvCell(kpi.label)};${escapeCsvCell(kpi.value)};${escapeCsvCell(kpi.sublabel || '')}`
      );
    }
    lines.push('');
  }

  if (doc.summaryNotes && doc.summaryNotes.length > 0) {
    lines.push('=== NOTAS TÉCNICAS E ENQUADRAMENTO DE GESTÃO ===');
    for (const note of doc.summaryNotes) {
      lines.push(`• ${escapeCsvCell(note)}`);
    }
    lines.push('');
  }

  for (const section of doc.sections) {
    lines.push(
      `=== ${section.title.toUpperCase()}${section.subtitle ? ` — ${section.subtitle}` : ''} ===`
    );
    lines.push(section.columns.map((c) => escapeCsvCell(getColLabel(c))).join(';'));

    for (const row of section.rows) {
      if (row.isSection) {
        const sec = getSectionTitleFromRow(row);
        lines.push(`${escapeCsvCell(sec.code)};${escapeCsvCell(sec.title)};`);
        continue;
      }
      const rowCells = section.columns.map((col, idx) => {
        const raw = getRawCellValue(row, col, idx);
        return escapeCsvCell(formatCellDisplay(raw, col, true));
      });
      lines.push(rowCells.join(';'));
    }
    lines.push('');
  }

  const sigs = doc.signatures || [
    `A Administração / Gerência Executiva (${doc.meta.companyName})`,
    'A Direcção Financeira / Contabilista Certificado (OCPCA)',
  ];
  lines.push('=== TERMO DE VALIDAÇÃO E RESPONSABILIDADE CORPORATIVA ===');
  lines.push(sigs.map((s) => `${escapeCsvCell(s)}:;_______________________________`).join(';'));

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.filenameBase}.csv`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const exportCorporateReportExcel = (doc: CorporateReportDocument) => {
  const nowStr = new Date().toLocaleString('pt-AO');
  const maxCols = Math.max(4, ...doc.sections.map((s) => s.columns.length));

  const renderSectionHtml = (section: ReportSection) => {
    const colorKey = section.headerColor || section.theme || 'slate';
    const bgHex = SECTION_BG_HEX[colorKey] || SECTION_BG_HEX.slate;
    const colCount = section.columns.length;

    const headerCells = section.columns
      .map(
        (c) => `
          <th style="background-color:#1e293b; color:#ffffff; padding:8px 10px; border:1px solid #0f172a; text-align:${c.align || 'left'}; font-size:9pt; text-transform:uppercase;">
            ${escapeHtml(getColLabel(c))}
          </th>`
      )
      .join('');

    const bodyRows = section.rows
      .map((row, rIdx) => {
        if (row.isSection) {
          const sec = getSectionTitleFromRow(row);
          return `
            <tr>
              <td colspan="${colCount}" style="background-color:#e2e8f0; color:#0f172a; font-weight:bold; font-size:9.5pt; padding:7px 10px; border:1px solid #cbd5e1;">
                ${sec.code ? `[${escapeHtml(sec.code)}] ` : ''}${escapeHtml(sec.title)}
              </td>
            </tr>`;
        }

        if (row.isTotal) {
          return `
            <tr>
              ${section.columns
                .map((c, cIdx) => {
                  const raw = getRawCellValue(row, c, cIdx);
                  const disp = formatCellDisplay(raw, c, false);
                  return `<td style="background-color:#0f172a; color:#ffffff; font-weight:bold; font-size:9.5pt; text-align:${c.align || 'left'}; padding:8px 10px; border:1px solid #0f172a; ${c.mono ? 'font-family:Consolas, monospace;' : ''}">${escapeHtml(disp)}</td>`;
                })
                .join('')}
            </tr>`;
        }

        if (row.isSubtotal) {
          return `
            <tr>
              ${section.columns
                .map((c, cIdx) => {
                  const raw = getRawCellValue(row, c, cIdx);
                  const disp = formatCellDisplay(raw, c, false);
                  const isNeg =
                    row.isNegative ||
                    (typeof raw === 'number' && raw < 0) ||
                    String(disp).startsWith('-');
                  return `<td style="background-color:#f1f5f9; color:${isNeg ? '#b91c1c' : '#0f172a'}; font-weight:bold; text-align:${c.align || 'left'}; padding:6px 10px; border-top:1px solid #94a3b8; border-bottom:1px solid #94a3b8; border-left:1px solid #cbd5e1; border-right:1px solid #cbd5e1; ${c.mono ? 'font-family:Consolas, monospace;' : ''}">${escapeHtml(disp)}</td>`;
                })
                .join('')}
            </tr>`;
        }

        const zebraBg = rIdx % 2 === 1 ? '#f8fafc' : '#ffffff';
        const rowBg =
          row.highlightTone === 'danger'
            ? '#fef2f2'
            : row.highlightTone === 'warning'
            ? '#fffbeb'
            : row.highlightTone === 'success'
            ? '#ecfdf5'
            : zebraBg;

        return `
          <tr>
            ${section.columns
              .map((c, cIdx) => {
                const raw = getRawCellValue(row, c, cIdx);
                const disp = formatCellDisplay(raw, c, false);
                const isNeg =
                  (typeof raw === 'number' && raw < 0) ||
                  String(disp).startsWith('-') ||
                  String(disp).startsWith('(-') ||
                  (row.isNegative && c.isCurrency && cIdx === section.columns.length - 1);
                const textColor =
                  isNeg || row.highlightTone === 'danger'
                    ? '#b91c1c'
                    : row.highlightTone === 'warning'
                    ? '#b45309'
                    : row.highlightTone === 'success'
                    ? '#047857'
                    : '#1e293b';
                return `<td style="background-color:${rowBg}; color:${textColor}; text-align:${c.align || 'left'}; padding:5.5px 10px; border:1px solid #e2e8f0; ${c.mono ? 'font-family:Consolas, monospace;' : ''}">${escapeHtml(disp)}</td>`;
              })
              .join('')}
          </tr>`;
      })
      .join('');

    return `
      <tr>
        <td colspan="${colCount}" style="background-color:${bgHex}; color:#ffffff; font-size:10.5pt; font-weight:bold; padding:8px 12px; border:1px solid ${bgHex};">
          ${escapeHtml(section.title)} ${section.subtitle ? `&nbsp;—&nbsp; <span style="font-weight:normal; font-size:9pt;">${escapeHtml(section.subtitle)}</span>` : ''}
        </td>
      </tr>
      <tr>${headerCells}</tr>
      ${bodyRows}
      <tr><td colspan="${colCount}" style="height:14px;"></td></tr>
    `;
  };

  const kpiBlockHtml =
    doc.kpis && doc.kpis.length > 0
      ? `
        <tr>
          <td colspan="${maxCols}" style="background-color:#0f172a; color:#ffffff; font-weight:bold; font-size:9.5pt; padding:7px 12px; border:1px solid #0f172a;">
            SÍNTESE EXECUTIVA DE INDICADORES DE DESEMPENHO E CONTROLO (KPIs)
          </td>
        </tr>
        <tr>
          <th colspan="2" style="background-color:#f1f5f9; color:#334155; padding:6px 10px; border:1px solid #cbd5e1; text-align:left;">Indicador de Gestão</th>
          <th style="background-color:#f1f5f9; color:#334155; padding:6px 10px; border:1px solid #cbd5e1; text-align:right;">Valor Apurado</th>
          <th colspan="${Math.max(1, maxCols - 3)}" style="background-color:#f1f5f9; color:#334155; padding:6px 10px; border:1px solid #cbd5e1; text-align:left;">Enquadramento / Detalhe</th>
        </tr>
        ${doc.kpis
          .map((k) => {
            const toneStyle = KPI_TONE_HEX[k.tone || 'default'] || KPI_TONE_HEX.default;
            return `
          <tr>
            <td colspan="2" style="padding:6px 10px; border:1px solid #e2e8f0; font-weight:bold; color:#0f172a; background-color:#ffffff;">${escapeHtml(k.label)}</td>
            <td style="padding:6px 10px; border:1px solid #e2e8f0; text-align:right; font-weight:bold; font-family:Consolas, monospace; color:${toneStyle.text}; background-color:${toneStyle.bg};">${escapeHtml(k.value)}</td>
            <td colspan="${Math.max(1, maxCols - 3)}" style="padding:6px 10px; border:1px solid #e2e8f0; color:#475569; font-size:8.5pt; background-color:#ffffff;">${escapeHtml(k.sublabel || '')}</td>
          </tr>`;
          })
          .join('')}
        <tr><td colspan="${maxCols}" style="height:14px;"></td></tr>
      `
      : '';

  const notesBlockHtml =
    doc.summaryNotes && doc.summaryNotes.length > 0
      ? `
        <tr>
          <td colspan="${maxCols}" style="background-color:#eff6ff; color:#1e3a8a; font-weight:bold; font-size:9pt; padding:6px 10px; border:1px solid #bfdbfe;">
            NOTAS EXPLICATIVAS E RELEVÂNCIA DE GESTÃO
          </td>
        </tr>
        ${doc.summaryNotes
          .map(
            (n) => `
          <tr>
            <td colspan="${maxCols}" style="background-color:#f8fafc; color:#334155; font-size:8.5pt; padding:4px 10px; border:1px solid #e2e8f0;">
              • ${escapeHtml(n)}
            </td>
          </tr>`
          )
          .join('')}
        <tr><td colspan="${maxCols}" style="height:12px;"></td></tr>
      `
      : '';

  const sigs = doc.signatures || [
    `A Administração / Gerência Executiva (${doc.meta.companyName})`,
    'A Direcção Financeira / Contabilista Certificado (OCPCA)',
  ];

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${escapeHtml(doc.title.slice(0, 28).replace(/[\\/?*[\]:]/g, ' '))}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <style>
        body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 9pt; color: #1e293b; }
        table { border-collapse: collapse; width: 100%; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="${maxCols}" style="background-color:#0f172a; color:#ffffff; font-size:11pt; font-weight:bold; text-align:left; padding:8px 10px;">
            ${escapeHtml(doc.meta.companyName.toUpperCase())}
          </td>
        </tr>
        <tr>
          <td colspan="${maxCols}" style="background-color:#f8fafc; font-size:8.5pt; color:#334155; text-align:left; padding:4px 10px; border-bottom:2px solid #0f172a; border-left:1px solid #cbd5e1; border-right:1px solid #cbd5e1;">
            NIF: <b>${escapeHtml(doc.meta.nif)}</b> &nbsp;|&nbsp; Moeda: <b>${escapeHtml(doc.meta.currency || 'Kwanzas (AOA)')}</b>
          </td>
        </tr>
        <tr>
          <td colspan="${maxCols}" style="font-size:12pt; font-weight:bold; color:#1e3a8a; text-align:center; padding:8px 10px 2px 10px;">
            ${escapeHtml(doc.title.toUpperCase())}
          </td>
        </tr>
        ${
          doc.subtitle
            ? `<tr>
                <td colspan="${maxCols}" style="font-size:9.5pt; color:#475569; text-align:center; padding:2px 10px;">
                  ${escapeHtml(doc.subtitle)}
                </td>
              </tr>`
            : ''
        }
        <tr>
          <td colspan="${maxCols}" style="font-size:8.5pt; color:#475569; text-align:center; padding-bottom:8px;">
            Período: <b>${escapeHtml(doc.meta.periodLabel)}</b> &nbsp;|&nbsp; Moeda: <b>${escapeHtml(doc.meta.currency || 'Kwanzas (AOA)')}</b> &nbsp;|&nbsp; Ref: <b>${escapeHtml(doc.meta.documentCode || 'REL-AO')}</b>
            ${doc.meta.normativeRef ? ` &nbsp;|&nbsp; ${escapeHtml(doc.meta.normativeRef)}` : ''}
          </td>
        </tr>
        <tr><td colspan="${maxCols}" style="height:10px;"></td></tr>
        ${kpiBlockHtml}
        ${notesBlockHtml}
        ${doc.sections.map(renderSectionHtml).join('')}
        <tr>
          <td colspan="${Math.floor(maxCols / 2)}" style="padding:22px 10px 6px 10px; border-top:1px solid #94a3b8; text-align:center; font-weight:bold;">
            __________________________________________________<br/>
            ${escapeHtml(sigs[0] || 'A Administração / Gerência')}
          </td>
          <td colspan="${maxCols - Math.floor(maxCols / 2)}" style="padding:22px 10px 6px 10px; border-top:1px solid #94a3b8; text-align:center; font-weight:bold;">
            __________________________________________________<br/>
            ${escapeHtml(sigs[1] || 'Direcção Financeira / Contabilista Certificado')}
          </td>
        </tr>
        <tr>
          <td colspan="${maxCols}" style="padding-top:12px; font-size:8pt; color:#64748b; text-align:right;">
            ${escapeHtml(doc.footerNote || 'Documento oficial processado por computador · Kudiba ERP')} · Certificação AGT: ${escapeHtml(doc.meta.agtCertNumber || 'FE/528/AGT/2026')} · Emitido em ${nowStr}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.filenameBase}.xls`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export const exportCorporateReportPdf = (doc: CorporateReportDocument) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const nowStr = new Date().toLocaleString('pt-AO');
  const maxSectionCols = Math.max(1, ...doc.sections.map((s) => s.columns.length));
  const pageOrientation = doc.orientation || (maxSectionCols >= 8 ? 'landscape' : 'portrait');
  const initials = (doc.meta.tradeName || doc.meta.companyName || 'KD')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  const logoHtml = doc.meta.logoDataUrl
    ? `<img src="${doc.meta.logoDataUrl}" alt="Logotipo" class="company-logo" />`
    : `<div class="company-monogram">${escapeHtml(initials || 'KD')}</div>`;

  const kpisHtml =
    doc.kpis && doc.kpis.length > 0
      ? `
        <div class="kpi-grid" style="grid-template-columns: repeat(${Math.min(4, doc.kpis.length)}, 1fr);">
          ${doc.kpis
            .map((k) => {
              const toneStyle = KPI_TONE_HEX[k.tone || 'default'] || KPI_TONE_HEX.default;
              return `
              <div class="kpi-card" style="border-left-color:${toneStyle.border}; background:${toneStyle.bg};">
                <div class="kpi-title">${escapeHtml(k.label)}</div>
                <div class="kpi-value" style="color:${toneStyle.text};">${escapeHtml(k.value)}</div>
                ${k.sublabel ? `<div class="kpi-sub">${escapeHtml(k.sublabel)}</div>` : ''}
              </div>`;
            })
            .join('')}
        </div>
      `
      : '';

  const summaryNotesHtml =
    doc.summaryNotes && doc.summaryNotes.length > 0
      ? `
        <div class="executive-notes">
          <div class="executive-notes-title">Síntese Executiva &amp; Enquadramento Técnico</div>
          <ul>
            ${doc.summaryNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
          </ul>
        </div>
      `
      : '';

  const sectionsHtml = doc.sections
    .map((section) => {
      const colorKey = section.headerColor || section.theme || 'slate';
      const bgHex = SECTION_BG_HEX[colorKey] || SECTION_BG_HEX.slate;
      const colCount = section.columns.length;

      const theadCells = section.columns
        .map(
          (c) => `
            <th style="${c.width ? `width:${c.width};` : ''} text-align:${c.align || 'left'};">
              ${escapeHtml(getColLabel(c))}
            </th>`
        )
        .join('');

      const tbodyRows = section.rows
        .map((row, rIdx) => {
          if (row.isSection) {
            const sec = getSectionTitleFromRow(row);
            return `
              <tr class="section-row">
                <td colspan="${colCount}">
                  ${sec.code ? `<span class="code-badge">${escapeHtml(sec.code)}</span> ` : ''}
                  ${escapeHtml(sec.title)}
                </td>
              </tr>`;
          }

          const rowClass = row.isTotal
            ? 'total-row'
            : row.isSubtotal
            ? 'subtotal-row'
            : row.highlightTone === 'danger'
            ? 'item-row tone-danger'
            : row.highlightTone === 'warning'
            ? 'item-row tone-warning'
            : row.highlightTone === 'success'
            ? 'item-row tone-success'
            : rIdx % 2 === 1
            ? 'item-row zebra-row'
            : 'item-row';

          return `
            <tr class="${rowClass}">
              ${section.columns
                .map((c, cIdx) => {
                  const raw = getRawCellValue(row, c, cIdx);
                  const disp = formatCellDisplay(raw, c, false);
                  const isNeg =
                    !row.isTotal &&
                    ((typeof raw === 'number' && raw < 0) ||
                      disp.startsWith('-') ||
                      disp.startsWith('(-') ||
                      (row.isNegative && c.isCurrency && cIdx === section.columns.length - 1));
                  return `<td class="${c.mono ? 'font-mono' : ''} text-${c.align || 'left'} ${isNeg ? 'text-danger' : ''}">${escapeHtml(disp)}</td>`;
                })
                .join('')}
            </tr>`;
        })
        .join('');

      return `
        <div class="section-block">
          <div class="section-header" style="background:${bgHex};">
            <span class="section-title-text">${escapeHtml(section.title)}</span>
            ${section.badgeText || section.subtitle ? `<span class="section-badge">${escapeHtml(section.badgeText || section.subtitle)}</span>` : ''}
          </div>
          <table>
            <thead><tr>${theadCells}</tr></thead>
            <tbody>${tbodyRows}</tbody>
          </table>
        </div>
      `;
    })
    .join('');

  const sigs = doc.signatures || [
    `A Administração / Gerência Executiva — ${doc.meta.companyName}`,
    'A Direcção Financeira / Contabilista Certificado (OCPCA)',
  ];

  const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(doc.title)} - ${escapeHtml(doc.meta.companyName)}</title>
      <style>
        @page {
          size: A4 ${pageOrientation};
          margin: 11mm 13mm 13mm 13mm;
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
          font-size: 8.4pt;
          line-height: 1.38;
          color: #1e293b;
          background: #ffffff;
          padding: 8px;
        }
        .top-accent-bar {
          height: 4px;
          background: linear-gradient(90deg, #0f172a 0%, #1e3a8a 50%, #047857 100%);
          border-radius: 2px;
          margin-bottom: 10px;
        }
        .header-box {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 12px;
          border-bottom: 1.5px solid #0f172a;
          padding-bottom: 5px;
          margin-bottom: 8px;
        }
        .brand-col {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1.5px;
        }
        .company-logo {
          max-height: 28px;
          max-width: 85px;
          object-fit: contain;
          margin-bottom: 2px;
        }
        .company-monogram {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: linear-gradient(135deg, #0f172a 0%, #047857 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8.5pt;
          font-weight: 800;
          margin-bottom: 2px;
        }
        .company-name {
          font-size: 8.5pt;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: -0.2px;
          line-height: 1.15;
        }
        .company-meta {
          font-size: 7.2pt;
          color: #334155;
          line-height: 1.2;
        }
        .doc-box {
          text-align: right;
          max-width: 45%;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 3px 7px;
        }
        .doc-badge {
          display: inline-block;
          background: #0f172a;
          color: #ffffff;
          font-size: 6.8pt;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 5px;
          border-radius: 3px;
          margin-bottom: 2px;
          letter-spacing: 0.3px;
        }
        .doc-title {
          font-size: 9pt;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .doc-meta {
          font-size: 6.9pt;
          color: #475569;
          margin-top: 1px;
        }
        .meta-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          margin-bottom: 10px;
          font-size: 7.4pt;
        }
        .meta-strip-item span {
          display: block;
          font-size: 6.6pt;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .meta-strip-item strong {
          color: #0f172a;
          font-weight: 700;
        }
        .kpi-grid {
          display: grid;
          gap: 8px;
          margin: 8px 0 12px 0;
        }
        .kpi-card {
          border: 1px solid #cbd5e1;
          border-left-width: 4px;
          border-radius: 6px;
          padding: 7px 10px;
        }
        .kpi-title {
          font-size: 6.9pt;
          font-weight: 700;
          text-transform: uppercase;
          color: #475569;
          letter-spacing: 0.3px;
        }
        .kpi-value {
          font-size: 10.8pt;
          font-weight: 800;
          color: #0f172a;
          font-family: 'Consolas', 'Menlo', monospace;
          margin-top: 2px;
        }
        .kpi-sub {
          font-size: 6.9pt;
          color: #64748b;
          margin-top: 2px;
          font-weight: 500;
        }
        .executive-notes {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-left: 4px solid #1d4ed8;
          border-radius: 6px;
          padding: 7px 12px;
          margin-bottom: 12px;
          font-size: 7.6pt;
          color: #1e3a8a;
        }
        .executive-notes-title {
          font-weight: 800;
          text-transform: uppercase;
          font-size: 7.2pt;
          margin-bottom: 3px;
          letter-spacing: 0.3px;
        }
        .executive-notes ul {
          padding-left: 16px;
        }
        .executive-notes li {
          margin-bottom: 1.5px;
        }
        .section-block {
          margin-bottom: 14px;
        }
        .section-header {
          color: #ffffff;
          font-size: 8.8pt;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 5px 5px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .section-title-text {
          letter-spacing: 0.2px;
        }
        .section-badge {
          font-size: 7.2pt;
          font-weight: 600;
          background: rgba(255, 255, 255, 0.16);
          padding: 1.5px 7px;
          border-radius: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #cbd5e1;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        th {
          background: #e2e8f0;
          color: #1e293b;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 7pt;
          letter-spacing: 0.4px;
          padding: 5.5px 6px;
          border-bottom: 1.5px solid #94a3b8;
          border-right: 1px solid #cbd5e1;
        }
        td {
          padding: 4.5px 6px;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #f1f5f9;
          font-size: 7.9pt;
        }
        .zebra-row td {
          background: #f8fafc;
        }
        .font-mono { font-family: 'Consolas', 'Menlo', monospace; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-danger { color: #b91c1c !important; font-weight: 600; }
        .section-row td {
          background: #cbd5e1;
          font-weight: 800;
          color: #0f172a;
          font-size: 7.9pt;
          padding: 5px 8px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .code-badge {
          display: inline-block;
          background: #0f172a;
          color: #ffffff;
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 6.8pt;
          font-weight: 700;
          font-family: Consolas, monospace;
        }
        .subtotal-row td {
          background: #e2e8f0 !important;
          font-weight: 700;
          color: #0f172a;
          border-top: 1px solid #64748b;
          border-bottom: 1px solid #64748b;
        }
        .total-row td {
          background: #0f172a !important;
          color: #ffffff !important;
          font-weight: 800;
          font-size: 8.4pt;
          border-top: 1.5px solid #0f172a;
          border-bottom: 1.5px solid #0f172a;
        }
        .tone-danger td { background: #fef2f2 !important; }
        .tone-warning td { background: #fffbeb !important; }
        .tone-success td { background: #ecfdf5 !important; }
        .signatures-grid {
          display: grid;
          grid-template-columns: repeat(${sigs.length}, 1fr);
          gap: 28px;
          margin-top: 28px;
          padding-top: 10px;
          page-break-inside: avoid;
        }
        .sig-line {
          border-top: 1px solid #475569;
          text-align: center;
          font-size: 7.6pt;
          padding-top: 5px;
          color: #1e293b;
          font-weight: 700;
        }
        .footer-note {
          margin-top: 14px;
          font-size: 6.9pt;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #cbd5e1;
          padding-top: 6px;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="top-accent-bar"></div>
      <div class="header-box">
        <div class="brand-col">
          ${logoHtml}
          <div class="company-name">${escapeHtml(doc.meta.companyName)}</div>
          <div class="company-meta">
            NIF: <strong>${escapeHtml(doc.meta.nif)}</strong> &nbsp;·&nbsp; Moeda: <strong>${escapeHtml(doc.meta.currency || 'Kwanzas (AOA)')}</strong>
          </div>
        </div>
        <div class="doc-box">
          <div class="doc-badge">Relatório Corporativo Oficial · ${escapeHtml(doc.meta.documentCode || 'KUDIBA-ERP')}</div>
          <div class="doc-title">${escapeHtml(doc.title)}</div>
          ${doc.subtitle ? `<div class="doc-meta">${escapeHtml(doc.subtitle)}</div>` : ''}
        </div>
      </div>

      <div class="meta-strip">
        <div class="meta-strip-item">
          <span>Período de Relato</span>
          <strong>${escapeHtml(doc.meta.periodLabel)}</strong>
        </div>
        <div class="meta-strip-item">
          <span>Estabelecimento / Filial</span>
          <strong>${escapeHtml(doc.meta.branchName || 'Sede Principal')}</strong>
        </div>
        <div class="meta-strip-item">
          <span>Certificação de Software</span>
          <strong>${escapeHtml(doc.meta.agtCertNumber || 'FE/528/AGT/2026')}</strong>
        </div>
        <div class="meta-strip-item">
          <span>Enquadramento Legal</span>
          <strong>${escapeHtml(doc.meta.normativeRef || 'PGC Angola / AGT')}</strong>
        </div>
      </div>

      ${kpisHtml}
      ${summaryNotesHtml}
      ${sectionsHtml}

      <div class="signatures-grid">
        ${sigs.map((s) => `<div class="sig-line">${escapeHtml(s)}</div>`).join('')}
      </div>

      <div class="footer-note">
        <span>${escapeHtml(doc.footerNote || 'Kudiba ERP — Sistema Integrado de Gestão e Relato Corporativo')}</span>
        <span>Emitido em ${nowStr}</span>
        <span>Software Certificado AGT (${escapeHtml(doc.meta.agtCertNumber || 'FE/528/AGT/2026')})</span>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 350);
};
