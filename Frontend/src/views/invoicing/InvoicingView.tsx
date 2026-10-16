import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  PlusCircle,
  Eye,
  Printer,
  Download,
  Ban,
  ShieldCheck,
  CheckCircle2,
  Layers,
  FileCheck2,
  AlertCircle,
  X,
  Trash2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  invoicingApi,
  Invoice,
  IssueInvoicePayload,
} from '../../api/invoicing';

type ActiveTab = 'invoices' | 'new_invoice' | 'series' | 'saft';

export const InvoicingView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('invoices');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [thermalTicketText, setThermalTicketText] = useState<string | null>(null);

  // Queries
  const {
    data: invoices = [],
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useQuery({
    queryKey: ['invoices', activeTenant?.id],
    queryFn: () => invoicingApi.listInvoices({ fiscalYear: 2026, limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series', activeTenant?.id],
    queryFn: () => invoicingApi.listSeries(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: taxRegimesData } = useQuery({
    queryKey: ['taxRegimes', activeTenant?.id],
    queryFn: () => invoicingApi.listTaxRegimes(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products', activeTenant?.id],
    queryFn: () => invoicingApi.getProducts(),
    enabled: Boolean(activeTenant?.id),
  });

  // Formulário de Novo Documento
  const [docType, setDocType] = useState<'FT' | 'FR' | 'NC' | 'ND'>('FT');
  const [seriesCode, setSeriesCode] = useState<string>('2026A');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerNif, setCustomerNif] = useState<string>('5000123456');
  const [customerAddress, setCustomerAddress] = useState<string>('Rua Principal, Luanda');
  const [paymentMethod, setPaymentMethod] = useState<string>('NUMERARIO');
  const [applyWithholding, setApplyWithholding] = useState<boolean>(false);
  const [sourceDocNumber, setSourceDocNumber] = useState<string>('');

  const [lines, setLines] = useState<
    Array<{
      productCode: string;
      description: string;
      quantity: number;
      unitPrice: number;
      taxRate: number;
      isService: boolean;
    }>
  >([
    {
      productCode: 'SERV-001',
      description: 'Consultoria e Suporte Técnico TI',
      quantity: 1,
      unitPrice: 150000,
      taxRate: 14,
      isService: true,
    },
  ]);

  // Cálculos do formulário
  const netSubtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const taxSubtotal = lines.reduce(
    (acc, l) => acc + l.quantity * l.unitPrice * (l.taxRate / 100),
    0
  );
  const servicesSubtotal = lines
    .filter((l) => l.isService)
    .reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
  const withholdingSubtotal = applyWithholding ? servicesSubtotal * 0.065 : 0;
  const totalAmount = netSubtotal + taxSubtotal - withholdingSubtotal;

  // Mutations
  const issueMutation = useMutation({
    mutationFn: (payload: IssueInvoicePayload) => invoicingApi.issueInvoice(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSelectedInvoice(data);
      setActiveTab('invoices');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoicingApi.cancelInvoice(id, {
        tenantId: activeTenant!.id,
        reason,
        seriesCode: '2026A',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCancelModalInvoice(null);
      setCancelReason('');
    },
  });

  const [newSeriesType, setNewSeriesType] = useState('FT');
  const [newSeriesCode, setNewSeriesCode] = useState('2026B');
  const createSeriesMutation = useMutation({
    mutationFn: (payload: {
      tenantId: string;
      documentType: string;
      seriesCode: string;
      fiscalYear: number;
    }) => invoicingApi.createSeries(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setNewSeriesCode('');
    },
  });

  // Ações de SAF-T
  const [saftStart, setSaftStart] = useState('2026-01-01');
  const [saftEnd, setSaftEnd] = useState('2026-12-31');
  const [saftLoading, setSaftLoading] = useState(false);

  const handleDownloadSaft = async () => {
    try {
      setSaftLoading(true);
      const blob = await invoicingApi.exportSaftXml(saftStart, saftEnd);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT_AO_2026_${activeTenant?.taxId || 'Kudiba'}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar SAF-T XML. Verifique os dados fiscais.');
    } finally {
      setSaftLoading(false);
    }
  };

  const handleViewThermal = async (inv: Invoice) => {
    try {
      const text = await invoicingApi.getInvoiceThermal(inv.id);
      setThermalTicketText(text);
      setSelectedInvoice(inv);
    } catch {
      alert('Erro ao carregar layout térmico.');
    }
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    try {
      const blob = await invoicingApi.getInvoicePdf(inv.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.documentNumber.replace('/', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao transferir PDF.');
    }
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        productCode: `PROD-${Date.now().toString().slice(-4)}`,
        description: 'Artigo / Serviço Comercial',
        quantity: 1,
        unitPrice: 5000,
        taxRate: 14,
        isService: false,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSelectProduct = (idx: number, prodCode: string) => {
    const prod = products.find((p) => p.code === prodCode);
    if (!prod) return;
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productCode: prod.code,
              description: prod.name,
              unitPrice: parseFloat(prod.sale_price) || 0,
              taxRate: parseFloat(prod.tax_percentage) || 14,
              isService: prod.product_type === 'S',
            }
          : l
      )
    );
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant?.id) return;

    if ((docType === 'NC' || docType === 'ND') && !sourceDocNumber.trim()) {
      alert('Notas de Crédito e Débito exigem referência ao documento retificado.');
      return;
    }

    const payload: IssueInvoicePayload = {
      tenantId: activeTenant.id,
      documentType: docType,
      seriesCode,
      fiscalYear: 2026,
      customerName,
      customerNif: customerNif || undefined,
      customerAddress: customerAddress || undefined,
      customerCity: 'Luanda',
      customerCountry: 'AO',
      sourceDocumentNumber: sourceDocNumber || undefined,
      paymentMethods: [paymentMethod],
      applyWithholding,
      withholdingRate: applyWithholding ? 6.5 : undefined,
      lines: lines.map((l) => ({
        productCode: l.productCode,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRate: l.taxRate,
        isService: l.isService,
        taxExemptionCode: l.taxRate === 0 ? 'M02' : undefined,
      })),
    };

    issueMutation.mutate(payload);
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesType = filterType === 'ALL' || inv.documentType === filterType;
    const matchesSearch =
      searchTerm === '' ||
      inv.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.customerNif && inv.customerNif.includes(searchTerm));
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header com Abas */}
      <div className="no-print flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Faturação &amp; Gestão Fiscal AGT
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Emissão certificada (Dec. Pres. n.º 71/25 &amp; 385/20) • Chave RSA-2048 ativa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'invoices'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Documentos ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('new_invoice')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'new_invoice'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Emitir Documento</span>
          </button>

          <button
            onClick={() => setActiveTab('series')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'series'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Séries Fiscais</span>
          </button>

          <button
            onClick={() => setActiveTab('saft')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'saft'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>SAF-T (AO)</span>
          </button>
        </div>
      </div>

      {/* ABA 1: LISTA DE DOCUMENTOS */}
      {activeTab === 'invoices' && (
        <div className="space-y-4 no-print">
          <GlassCard className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Pesquisar por número, cliente ou NIF..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="FT">FT — Faturas</option>
                  <option value="FR">FR — Faturas-Recibo</option>
                  <option value="NC">NC — Notas de Crédito</option>
                  <option value="ND">ND — Notas de Débito</option>
                </select>

                <button
                  onClick={() => refetchInvoices()}
                  title="Atualizar"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            {invoicesLoading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                A carregar documentos fiscais certificados...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 space-y-2">
                <p>Nenhum documento fiscal encontrado com os filtros aplicados.</p>
                <button
                  onClick={() => setActiveTab('new_invoice')}
                  className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Emitir Primeira Fatura
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Nº Documento</th>
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3 text-right">Incidência</th>
                      <th className="py-2.5 px-3 text-right">IVA (14%)</th>
                      <th className="py-2.5 px-3 text-right">Total (Kz)</th>
                      <th className="py-2.5 px-3 text-center">Hash AGT</th>
                      <th className="py-2.5 px-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-xs font-extrabold ${
                              inv.documentType === 'NC'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {inv.documentType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {inv.documentNumber}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {inv.customerName}
                          </p>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            NIF: {inv.customerNif || 'Consumidor Final'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">
                          {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('pt-AO') : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <KzAmount value={inv.netTotal} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <KzAmount value={inv.taxTotal} />
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          <KzAmount value={inv.grossTotal} />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            {inv.validationChars || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              title="Visualizar A4"
                              className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewThermal(inv)}
                              title="Talão Térmico 80mm"
                              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadPdf(inv)}
                              title="Download PDF AGT"
                              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {inv.documentType !== 'NC' && (
                              <button
                                onClick={() => setCancelModalInvoice(inv)}
                                title="Anular com Nota de Crédito (NC)"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* ABA 2: EMISSÃO DE NOVO DOCUMENTO FISCAL */}
      {activeTab === 'new_invoice' && (
        <form onSubmit={handleIssueSubmit} className="space-y-6 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="lg:col-span-2 p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Dados do Documento Fiscal
                </h3>
                <StatusBadge status="ok" label="Motor AGT Conforme" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="FT">FT — Fatura</option>
                    <option value="FR">FR — Fatura-Recibo</option>
                    <option value="NC">NC — Nota de Crédito</option>
                    <option value="ND">ND — Nota de Débito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Série Fiscal
                  </label>
                  <select
                    value={seriesCode}
                    onChange={(e) => setSeriesCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {seriesList
                      .filter((s) => s.documentType === docType)
                      .map((s) => (
                        <option key={s.id} value={s.seriesCode}>
                          {s.seriesCode} (Seq: {s.currentSequence})
                        </option>
                      ))}
                    {seriesList.filter((s) => s.documentType === docType).length === 0 && (
                      <option value="2026A">2026A (Padrão)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Meio de Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="NUMERARIO">Numerário (Dinheiro)</option>
                    <option value="MULTICAIXA">Multicaixa (TPA)</option>
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="CREDITO">A Prazo (Crédito)</option>
                  </select>
                </div>
              </div>

              {(docType === 'NC' || docType === 'ND') && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    Documento de Origem Retificado (Obrigatório pela AGT)
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceDocNumber}
                    onChange={(e) => setSourceDocNumber(e.target.value)}
                    placeholder="Ex: FT 2026A/000001"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 font-mono text-sm"
                  />
                </div>
              )}

              {/* Dados do Cliente */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Dados do Adquirente / Cliente
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerName('Consumidor Final');
                      setCustomerNif('999999999');
                      setCustomerAddress('Luanda');
                    }}
                    className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                  >
                    + Consumidor Final
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      Nome / Razão Social
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex: Sonangol Distribuidora, S.A."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                      NIF (Angola)
                    </label>
                    <input
                      type="text"
                      required
                      value={customerNif}
                      onChange={(e) => setCustomerNif(e.target.value)}
                      placeholder="5000123456"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Morada Completa
                  </label>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Rua, Bairro, Município"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Linhas de Artigos */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Linhas de Artigos e Serviços
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Adicionar Linha
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Artigo / Código
                          </label>
                          <select
                            value={line.productCode}
                            onChange={(e) => handleSelectProduct(idx, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold"
                          >
                            <option value={line.productCode}>{line.productCode}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.code}>
                                {p.code} — {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Descrição
                          </label>
                          <input
                            type="text"
                            required
                            value={line.description}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, description: e.target.value } : l
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Preço Unit. (Kz)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            value={line.unitPrice}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, unitPrice: parseFloat(e.target.value) || 0 }
                                    : l
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-right"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[11px] text-slate-500 mb-1">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, quantity: parseFloat(e.target.value) || 1 }
                                    : l
                                )
                              )
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-center font-bold"
                          />
                        </div>

                        <div className="sm:col-span-1">
                          <label className="block text-[11px] text-slate-500 mb-1">IVA</label>
                          <select
                            value={line.taxRate}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, taxRate: parseFloat(e.target.value) } : l
                                )
                              )
                            }
                            className="w-full px-1.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                          >
                            <option value="14">14%</option>
                            <option value="7">7%</option>
                            <option value="5">5%</option>
                            <option value="0">0%</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1 flex justify-center pt-4">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-xs">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={line.isService}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, isService: e.target.checked } : l
                                )
                              )
                            }
                            className="rounded text-emerald-600"
                          />
                          <span>Prestação de Serviços (sujeito a Retenção de 6,5%)</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            {/* Painel Lateral de Resumo e Emissão */}
            <div className="space-y-4">
              <GlassCard className="p-6 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Apuramento Tributário (AGT)
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Incidência Líquida:</span>
                    <KzAmount value={netSubtotal} />
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA Liquidado (14%):</span>
                    <KzAmount value={taxSubtotal} />
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyWithholding}
                        onChange={(e) => setApplyWithholding(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Aplicar Retenção na Fonte (6,5%)
                      </span>
                    </label>
                    {applyWithholding && (
                      <div className="flex justify-between text-rose-600 font-semibold mt-1.5">
                        <span>Retenção (6,5% s/ Serviços):</span>
                        <span>- <KzAmount value={withholdingSubtotal} /></span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-sm font-extrabold text-slate-900 dark:text-white">
                    <span>TOTAL A PAGAR:</span>
                    <span className="text-xl text-emerald-700 dark:text-emerald-400">
                      <KzAmount value={totalAmount} />
                    </span>
                  </div>
                </div>

                {issueMutation.isError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    Erro ao emitir: {(issueMutation.error as any)?.response?.data?.error || 'Falha na validação'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={issueMutation.isPending || lines.length === 0}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>
                    {issueMutation.isPending
                      ? 'A assinar criptograficamente...'
                      : 'Emitir & Assinar Fiscalmente'}
                  </span>
                </button>
              </GlassCard>

              <GlassCard className="p-4 space-y-2 text-xs text-slate-500">
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cadeia de Hash J-1 Criptografada</span>
                </div>
                <p>
                  O documento será assinado com chave privada RSA-2048, gerando os 4 caracteres de
                  controlo e o registo na tabela sequencial imutável.
                </p>
              </GlassCard>
            </div>
          </div>
        </form>
      )}

      {/* ABA 3: GESTÃO DE SÉRIES FISCAIS */}
      {activeTab === 'series' && (
        <div className="space-y-6 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="lg:col-span-2 p-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                Séries Fiscais Ativas (Exercício 2026)
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500">
                      <th className="py-2.5 px-3">Tipo Doc</th>
                      <th className="py-2.5 px-3">Código Série</th>
                      <th className="py-2.5 px-3">Ano Fiscal</th>
                      <th className="py-2.5 px-3 text-right">Última Sequência</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {seriesList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-bold text-emerald-700">{s.documentType}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {s.seriesCode}
                        </td>
                        <td className="py-3 px-3 font-mono">{s.fiscalYear}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {s.currentSequence}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <StatusBadge status="ok" label="Ativa / Emissão Aberta" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Abrir Nova Série Fiscal
              </h3>
              <p className="text-xs text-slate-500">
                Criação de série contínua com registo do primeiro hash e inicializador de sequência.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!activeTenant?.id) return;
                  createSeriesMutation.mutate({
                    tenantId: activeTenant.id,
                    documentType: newSeriesType,
                    seriesCode: newSeriesCode,
                    fiscalYear: 2026,
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={newSeriesType}
                    onChange={(e) => setNewSeriesType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-bold"
                  >
                    <option value="FT">FT — Fatura</option>
                    <option value="FR">FR — Fatura-Recibo</option>
                    <option value="NC">NC — Nota de Crédito</option>
                    <option value="ND">ND — Nota de Débito</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Código da Série
                  </label>
                  <input
                    type="text"
                    required
                    value={newSeriesCode}
                    onChange={(e) => setNewSeriesCode(e.target.value.toUpperCase())}
                    placeholder="Ex: 2026B ou LOJA2"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-mono font-bold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={createSeriesMutation.isPending}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
                >
                  {createSeriesMutation.isPending ? 'A registar...' : 'Criar Série'}
                </button>
              </form>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ABA 4: SAF-T (AO) & REGIMES */}
      {activeTab === 'saft' && (
        <div className="space-y-6 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-600" />
                  Exportação do SAF-T (AO)
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  Dec. 385/20
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Gere o ficheiro XML oficial de auditoria fiscal em conformidade com as regras da
                Administração Geral Tributária (AGT).
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={saftStart}
                    onChange={(e) => setSaftStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={saftEnd}
                    onChange={(e) => setSaftEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleDownloadSaft}
                disabled={saftLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20"
              >
                <Download className="w-4 h-4" />
                <span>{saftLoading ? 'A gerar ficheiro SAF-T XML...' : 'Exportar SAF-T (AO) XML'}</span>
              </button>
            </GlassCard>

            <GlassCard className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Enquadramento Fiscal de IVA em Angola
              </h3>
              <p className="text-xs text-slate-500">
                Tabela oficial de regimes e taxas permitidas conforme Lei do IVA:
              </p>

              <div className="space-y-2">
                {taxRegimesData?.regimes?.map((r) => (
                  <div
                    key={r.regimeCode}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {r.displayName}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        Taxa Padrão: {r.standardRate}%
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Taxas Permitidas: {r.allowedRates.join('%, ')}%</span>
                      <span>Crédito Fiscal: {r.allowsInputVatCredit ? 'Sim' : 'Não'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL A4 AGT */}
      {selectedInvoice && !thermalTicketText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="no-print absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="invoice-a4 bg-white text-slate-900 p-8 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-emerald-800">
                    {activeTenant?.name || 'KUDIBA COMÉRCIO GERAL, LDA'}
                  </h3>
                  <p className="text-xs text-slate-600">{selectedInvoice.issuerAddress}</p>
                  <p className="text-xs text-slate-600">{selectedInvoice.issuerCity}, Angola</p>
                  <p className="text-xs font-mono text-slate-600 font-bold mt-1">
                    NIF: {selectedInvoice.issuerNif}
                  </p>
                </div>
                <div className="text-right">
                  <h4 className="text-lg font-extrabold text-slate-900">
                    {selectedInvoice.documentNumber}
                  </h4>
                  <p className="text-xs text-slate-600">
                    Data:{' '}
                    {selectedInvoice.issuedAt
                      ? new Date(selectedInvoice.issuedAt).toLocaleDateString('pt-AO')
                      : '—'}
                  </p>
                  <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ORIGINAL
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 my-4" />

              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dados do Adquirente
                </span>
                <p className="font-bold text-sm text-slate-900">{selectedInvoice.customerName}</p>
                <p className="text-xs font-mono text-slate-600">
                  NIF: {selectedInvoice.customerNif || 'Consumidor Final'}
                </p>
                {selectedInvoice.customerAddress && (
                  <p className="text-xs text-slate-600">{selectedInvoice.customerAddress}</p>
                )}
                {selectedInvoice.sourceDocumentNumber && (
                  <p className="text-xs text-amber-700 font-semibold mt-1">
                    Retifica o documento: {selectedInvoice.sourceDocumentNumber}
                  </p>
                )}
              </div>

              <table className="w-full text-xs text-left mb-6">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Descrição</th>
                    <th className="py-2 px-3 text-center">Qtd</th>
                    <th className="py-2 px-3 text-right">Preço Unit.</th>
                    <th className="py-2 px-3 text-right">Taxa IVA</th>
                    <th className="py-2 px-3 text-right">Total (Kz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.lines?.map((line, i) => (
                    <tr key={i}>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{line.productCode}</td>
                      <td className="py-2.5 px-3 font-semibold">{line.description}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <KzAmount value={line.unitPrice} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{line.taxRate}%</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <KzAmount value={line.lineTotal || line.quantity * line.unitPrice} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Incidência Líquida:</span>
                    <KzAmount value={selectedInvoice.netTotal} />
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total IVA:</span>
                    <KzAmount value={selectedInvoice.taxTotal} />
                  </div>
                  {selectedInvoice.withholdingTotal > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Retenção na Fonte (6,5%):</span>
                      <KzAmount value={selectedInvoice.withholdingTotal} />
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Documento:</span>
                    <KzAmount value={selectedInvoice.grossTotal} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-mono font-bold text-slate-700">
                  {selectedInvoice.validationChars}-Processado por programa validado nº 999/AGT/2026 Kudiba ERP
                </p>
                <p>Os bens/serviços foram colocados à disposição do adquirente na data do documento.</p>
              </div>
            </div>

            <div className="no-print flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => handleDownloadPdf(selectedInvoice)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold hover:bg-slate-100"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir A4</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TALÃO TÉRMICO 80mm */}
      {selectedInvoice && thermalTicketText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900 relative">
            <button
              onClick={() => {
                setThermalTicketText(null);
                setSelectedInvoice(null);
              }}
              className="no-print absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="no-print text-sm font-bold mb-2">Talão Térmico 80mm ESC/POS</h3>

            <pre className="ticket-80mm font-mono text-xs whitespace-pre-wrap p-4 bg-slate-50 border border-slate-200 rounded-lg max-h-[70vh] overflow-y-auto">
              {thermalTicketText}
            </pre>

            <div className="no-print flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setThermalTicketText(null);
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir 80mm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ANULAÇÃO VIA NC */}
      {cancelModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Anular Documento Fiscal
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              A AGT exige que documentos fiscais assinados sejam retificados via emissão de uma{' '}
              <strong>Nota de Crédito (NC)</strong> associada.
            </p>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono mb-4">
              Documento: <strong>{cancelModalInvoice.documentNumber}</strong>
              <br />
              Total: <KzAmount value={cancelModalInvoice.grossTotal} />
            </div>

            <div className="space-y-2 mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo Legal da Anulação / Devolução
              </label>
              <textarea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Erro nos artigos faturados a pedido do cliente."
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelModalInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Voltar
              </button>
              <button
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                onClick={() =>
                  cancelMutation.mutate({
                    id: cancelModalInvoice.id,
                    reason: cancelReason,
                  })
                }
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'A emitir NC...' : 'Confirmar & Emitir NC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
