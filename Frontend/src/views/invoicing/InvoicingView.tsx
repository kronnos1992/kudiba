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
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import {
  invoicingApi,
  Invoice,
  IssueInvoicePayload,
} from '../../api/invoicing';
import { inventoryApi, StockBalance } from '../../api/inventory';

type ActiveTab = 'invoices' | 'new_invoice' | 'series' | 'saft';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const InvoicingView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
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
    queryKey: ['invoices', activeTenant?.id, selectedYear],
    queryFn: () => invoicingApi.listInvoices({ fiscalYear: selectedYear, limit: 150 }),
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

  const { data: stockBalances = [] } = useQuery<StockBalance[]>({
    queryKey: ['stock_balances', activeTenant?.id],
    queryFn: () => inventoryApi.listAllStockBalances(),
    enabled: Boolean(activeTenant?.id),
  });

  const productStockMap = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const b of stockBalances) {
      const current = map.get(b.product_id) || 0;
      map.set(b.product_id, current + (Number(b.quantity_on_hand) || 0));
    }
    return map;
  }, [stockBalances]);

  const getProductByCode = (code: string) => products.find((p) => p.code === code);

  const getStockByCode = (code: string) => {
    const prod = getProductByCode(code);
    if (!prod) return 0;
    return productStockMap.get(prod.id) ?? 0;
  };

  // Formulário de Novo Documento
  const [docType, setDocType] = useState<'FT' | 'FR' | 'NC' | 'ND' | 'GT' | 'GR'>('FT');
  const [seriesCode, setSeriesCode] = useState<string>('2026A');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerNif, setCustomerNif] = useState<string>('5000123456');
  const [customerAddress, setCustomerAddress] = useState<string>('Rua Principal, Luanda');
  const [paymentMethod, setPaymentMethod] = useState<string>('NUMERARIO');
  const [applyWithholding, setApplyWithholding] = useState<boolean>(false);
  const [sourceDocNumber, setSourceDocNumber] = useState<string>('');

  // Dados de Transporte (GT / GR)
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState<string>('LD-45-89-AO');
  const [loadingAddress, setLoadingAddress] = useState<string>('Armazém Central Luanda');
  const [loadingCity, setLoadingCity] = useState<string>('Luanda');
  const [loadingDateTime, setLoadingDateTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [unloadingAddress, setUnloadingAddress] = useState<string>('Armazém Destino Viana');
  const [unloadingCity, setUnloadingCity] = useState<string>('Luanda');
  const [unloadingDateTime, setUnloadingDateTime] = useState<string>(new Date(Date.now() + 86400000).toISOString().slice(0, 16));

  const [saftValidationResult, setSaftValidationResult] = useState<{ isValid: boolean; errors?: string[] } | null>(null);
  const [isValidatingSaft, setIsValidatingSaft] = useState<boolean>(false);

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
  const defaultWithholdingRate = activeTenant?.default_withholding_rate ?? 6.5;
  const withholdingSubtotal = applyWithholding
    ? servicesSubtotal * (defaultWithholdingRate / 100)
    : 0;
  const totalAmount = netSubtotal + taxSubtotal - withholdingSubtotal;

  const stockErrors = React.useMemo(() => {
    if (docType === 'NC' || docType === 'ND') return [];
    const errors: string[] = [];
    const requestedByCode: Record<string, number> = {};
    for (const l of lines) {
      const prod = getProductByCode(l.productCode);
      const isService = l.isService || prod?.product_type === 'S' || prod?.is_stockable === false;
      if (!isService && l.productCode) {
        requestedByCode[l.productCode] =
          (requestedByCode[l.productCode] || 0) + (Number(l.quantity) || 0);
      }
    }
    for (const [code, qty] of Object.entries(requestedByCode)) {
      const prod = getProductByCode(code);
      const available = getStockByCode(code);
      if (qty > available) {
        errors.push(
          `Artigo "${prod?.name || code}" (${code}): solicitado ${qty} un., disponível em armazém apenas ${available} un.`
        );
      }
    }
    return errors;
  }, [lines, docType, products, productStockMap]);

  const serviceTransportErrors = React.useMemo(() => {
    if (docType !== 'GT' && docType !== 'GR') return [];
    const errors: string[] = [];
    for (const l of lines) {
      const prod = getProductByCode(l.productCode);
      const isService = l.isService || prod?.product_type === 'S' || prod?.is_stockable === false;
      if (isService) {
        errors.push(
          `O artigo "${l.description}" é um serviço. A legislação fiscal proíbe a inclusão de serviços em Guias de Transporte ou Remessa.`
        );
      }
    }
    return errors;
  }, [lines, docType, products]);

  const canSubmitInvoice =
    stockErrors.length === 0 && serviceTransportErrors.length === 0 && lines.length > 0;

  // Mutations
  const issueMutation = useMutation({
    mutationFn: async (payload: IssueInvoicePayload) => {
      const issued = await invoicingApi.issueInvoice(payload);
      const id = issued.invoiceId || issued.id;
      if (id) {
        try {
          return await invoicingApi.getInvoice(id);
        } catch {
          return issued as unknown as Invoice;
        }
      }
      return issued as unknown as Invoice;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal_audit_trail'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_all_stock_balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setSelectedInvoice(data);
      setActiveTab('invoices');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => {
      const activeNcSeries =
        seriesList.find((s) => s.documentType === 'NC' && s.isActive)?.seriesCode ||
        cancelModalInvoice?.documentNumber.split(' ')[1]?.split('/')[0] ||
        '2026A';
      return invoicingApi.cancelInvoice(id, {
        tenantId: activeTenant!.id,
        reason,
        seriesCode: activeNcSeries,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fiscal_audit_trail'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_all_stock_balances'] });
      setCancelModalInvoice(null);
      setCancelReason('');
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Erro ao emitir Nota de Crédito para estornar o documento.';
      alert(msg);
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
  const [saftYear, setSaftYear] = useState(currentYear);
  const [saftMonth, setSaftMonth] = useState<number | ''>('');
  const [saftLoading, setSaftLoading] = useState(false);

  const saftParams = () => {
    if (!activeTenant?.id) {
      throw new Error('Empresa activa não identificada.');
    }
    return {
      tenantId: activeTenant.id,
      year: saftYear,
      ...(saftMonth !== '' ? { month: Number(saftMonth) } : {}),
    };
  };

  const handleDownloadSaft = async () => {
    try {
      setSaftLoading(true);
      const blob = await invoicingApi.exportSaftXml(saftParams());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT_AO_${saftYear}${saftMonth !== '' ? `_${String(saftMonth).padStart(2, '0')}` : ''}_${activeTenant?.taxId || 'Kudiba'}.xml`;
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
    const isService = prod.product_type === 'S' || !prod.is_stockable;
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productCode: prod.code,
              description: prod.name,
              unitPrice: parseFloat(String(prod.sale_price)) || 0,
              taxRate: parseFloat(String(prod.tax_percentage)) || 14,
              isService,
            }
          : l
      )
    );
  };

  const handleValidateSaft = async () => {
    try {
      setIsValidatingSaft(true);
      setSaftValidationResult(null);
      const blob = await invoicingApi.exportSaftXml(saftParams());
      const text = await blob.text();
      const res = await invoicingApi.validateSaftXml(text);
      setSaftValidationResult(res);
    } catch (err: any) {
      setSaftValidationResult({
        isValid: false,
        errors: [err?.response?.data?.detail || 'Erro ao comunicar com validador XSD oficial.'],
      });
    } finally {
      setIsValidatingSaft(false);
    }
  };

  const handleDownloadTaxPdf = async () => {
    try {
      const blob = await invoicingApi.getTaxReportPdf(saftParams());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mapa_IVA_${saftYear}${saftMonth !== '' ? `_${String(saftMonth).padStart(2, '0')}` : ''}_${activeTenant?.taxId || 'Kudiba'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao transferir Mapa de Impostos em PDF.');
    }
  };

  const handleDownloadTaxExcel = async () => {
    try {
      const blob = await invoicingApi.getTaxReportExcel(saftParams());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mapa_IVA_${saftYear}${saftMonth !== '' ? `_${String(saftMonth).padStart(2, '0')}` : ''}_${activeTenant?.taxId || 'Kudiba'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao transferir Mapa de Impostos em Excel.');
    }
  };

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant?.id) return;

    if (stockErrors.length > 0) {
      alert(`Emissão bloqueada: Existem artigos com stock insuficiente em armazém.\n\n${stockErrors.join('\n')}`);
      return;
    }

    if (serviceTransportErrors.length > 0) {
      alert(`Emissão bloqueada: Regras fiscais para documentos de transporte.\n\n${serviceTransportErrors.join('\n')}`);
      return;
    }

    if ((docType === 'NC' || docType === 'ND') && !sourceDocNumber.trim()) {
      alert('Notas de Crédito e Débito exigem referência ao documento retificado.');
      return;
    }

    if ((docType === 'GT' || docType === 'GR') && !vehiclePlateNumber.trim()) {
      alert('Guias de Transporte e Remessa exigem a matrícula da viatura conforme regras fiscais.');
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
      vehiclePlateNumber: (docType === 'GT' || docType === 'GR') ? vehiclePlateNumber : undefined,
      loadingAddress: (docType === 'GT' || docType === 'GR') ? loadingAddress : undefined,
      loadingCity: (docType === 'GT' || docType === 'GR') ? loadingCity : undefined,
      loadingDateTime: (docType === 'GT' || docType === 'GR') ? loadingDateTime : undefined,
      unloadingAddress: (docType === 'GT' || docType === 'GR') ? unloadingAddress : undefined,
      unloadingCity: (docType === 'GT' || docType === 'GR') ? unloadingCity : undefined,
      unloadingDateTime: (docType === 'GT' || docType === 'GR') ? unloadingDateTime : undefined,
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

  const { sortedItems: sortedInvoices, sortConfig: invoicesSort, requestSort: requestInvoicesSort } = useTableSort(filteredInvoices, 'issuedAt', 'desc');

  const summaryTotals = filteredInvoices.reduce(
    (acc, inv) => {
      const isNC = inv.documentType === 'NC';
      const gross = Number(inv.grossTotal) || 0;
      const net = Number(inv.netTotal) || 0;
      const tax = Number(inv.taxTotal) || 0;

      if (isNC) {
        acc.creditNotesGross += gross;
        acc.creditNotesCount += 1;
        acc.netEffective -= net;
        acc.taxEffective -= tax;
      } else {
        acc.grossInvoiced += gross;
        acc.invoicesCount += 1;
        acc.netEffective += net;
        acc.taxEffective += tax;
      }
      return acc;
    },
    {
      grossInvoiced: 0,
      creditNotesGross: 0,
      netEffective: 0,
      taxEffective: 0,
      invoicesCount: 0,
      creditNotesCount: 0,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header com Abas */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Facturação
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Emissão certificada (Dec. Pres. n.º 71/25 &amp; 385/20) • Chave RSA-2048 ativa
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
            className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
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
          {/* Barra de Resumo Fiscal da Listagem Filtrada */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <GlassCard className="p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Faturação Bruta
              </span>
              <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                <KzAmount value={summaryTotals.grossInvoiced} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {summaryTotals.invoicesCount} documento{summaryTotals.invoicesCount !== 1 ? 's' : ''} emitido{summaryTotals.invoicesCount !== 1 ? 's' : ''}
              </span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Notas de Crédito (NC)
              </span>
              <div className="text-base sm:text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {summaryTotals.creditNotesGross > 0 ? '-' : ''}
                <KzAmount value={summaryTotals.creditNotesGross} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {summaryTotals.creditNotesCount} estorno{summaryTotals.creditNotesCount !== 1 ? 's' : ''} abatido{summaryTotals.creditNotesCount !== 1 ? 's' : ''}
              </span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Receita Líquida Efetiva
              </span>
              <div className="text-base sm:text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                <KzAmount value={summaryTotals.netEffective} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Receita apurada após devoluções
              </span>
            </GlassCard>

            <GlassCard className="p-3.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                IVA Total Liquidado
              </span>
              <div className="text-base sm:text-lg font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                <KzAmount value={summaryTotals.taxEffective} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                Imposto devido ao Estado
              </span>
            </GlassCard>
          </div>

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

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800 text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Ano:</span>
                  <select
                    aria-label="Ano Fiscal"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent font-bold text-emerald-700 dark:text-emerald-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                    <option value={currentYear - 2}>{currentYear - 2}</option>
                  </select>
                </div>

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
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
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
              <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs">
                    <tr className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      <SortableHeader field="documentType" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Tipo
                      </SortableHeader>
                      <SortableHeader field="documentNumber" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Nº Documento
                      </SortableHeader>
                      <SortableHeader field="customerName" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Cliente
                      </SortableHeader>
                      <SortableHeader field="issuedAt" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Data
                      </SortableHeader>
                      <SortableHeader field="netTotal" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} align="right" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Incidência
                      </SortableHeader>
                      <SortableHeader
                        field="taxTotal"
                        currentSortField={invoicesSort?.key}
                        sortDirection={invoicesSort?.direction}
                        onSort={requestInvoicesSort}
                        align="right"
                        className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800"
                        title="Imposto liquidado (taxas 14%, 5% ou isenção 0%)"
                      >
                        IVA Liquidado
                      </SortableHeader>
                      <SortableHeader field="grossTotal" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} align="right" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Total (Kz)
                      </SortableHeader>
                      <SortableHeader field="status" currentSortField={invoicesSort?.key} sortDirection={invoicesSort?.direction} onSort={requestInvoicesSort} align="center" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                        Estado
                      </SortableHeader>
                      <th
                        className="sticky top-0 py-2.5 px-3 text-center bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800"
                        title="4 Caracteres de Validação do Hash J-1 (Decreto Executivo 385/20)"
                      >
                        Validação J-1
                      </th>
                      <th className="sticky top-0 py-2.5 px-3 text-center bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sortedInvoices.map((inv) => {
                      const isNC = inv.documentType === 'NC';
                      const isRectified =
                        inv.documentType === 'FT' &&
                        invoices.some(
                          (n) => n.documentType === 'NC' && n.sourceDocumentNumber === inv.documentNumber
                        );

                      return (
                        <tr
                          key={inv.id}
                          onClick={() => setSelectedInvoice(inv)}
                          title="Clique para abrir detalhes do documento (Drill-down)"
                          className={`cursor-pointer group transition-colors hover:bg-emerald-50/50 dark:hover:bg-slate-800/60 ${
                            isNC ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-xs font-extrabold ${
                                isNC
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                  : inv.documentType === 'FR'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400'
                              }`}
                            >
                              {inv.documentType}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold whitespace-nowrap">
                            <div className="text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:underline transition-colors flex items-center gap-1.5">
                              <span>{inv.documentNumber}</span>
                            </div>
                            {inv.sourceDocumentNumber && (
                              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-mono block">
                                Retifica: {inv.sourceDocumentNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                              {inv.customerName}
                            </p>
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                              NIF: {inv.customerNif || 'Consumidor Final'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('pt-AO') : '—'}
                          </td>
                          <td
                            className={`py-3 px-3 text-right whitespace-nowrap ${
                              isNC ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
                            }`}
                          >
                            {isNC ? '-' : ''}
                            <KzAmount value={inv.netTotal} />
                          </td>
                          <td
                            className={`py-3 px-3 text-right whitespace-nowrap ${
                              isNC ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
                            }`}
                          >
                            {isNC ? '-' : ''}
                            <KzAmount value={inv.taxTotal} />
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                              isNC ? 'text-rose-600 dark:text-rose-400' : ''
                            }`}
                          >
                            {isNC ? '-' : ''}
                            <KzAmount value={inv.grossTotal} />
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {isNC ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-500/20">
                                Estorno NC
                              </span>
                            ) : inv.documentType === 'FR' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20">
                                Liquidada
                              </span>
                            ) : isRectified ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 line-through">
                                Retificada por NC
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-500/20">
                                Crédito C/C
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-500/20"
                              title={`Caracteres de Validação J-1: ${inv.validationChars}`}
                            >
                              {inv.validationChars || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInvoice(inv);
                                }}
                                title="Visualizar A4 (Drill-down)"
                                className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewThermal(inv);
                                }}
                                title="Talão Térmico 80mm"
                                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadPdf(inv);
                                }}
                                title="Download PDF"
                                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {!isNC && !isRectified && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelModalInvoice(inv);
                                  }}
                                  title="Anular com Nota de Crédito (NC)"
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
            <GlassCard className="lg:col-span-2 p-4 sm:p-6 space-y-6 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Dados do Documento Fiscal
                </h3>
                <StatusBadge status="ok" label="Motor Fiscal Conforme" />
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
                    <option value="FT">FT — Fatura Comercial</option>
                    <option value="FR">FR — Fatura-Recibo</option>
                    <option value="NC">NC — Nota de Crédito</option>
                    <option value="ND">ND — Nota de Débito</option>
                    <option value="GT">GT — Guia de Transporte</option>
                    <option value="GR">GR — Guia de Remessa</option>
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

              {(docType === 'GT' || docType === 'GR') && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                    <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Dados Obrigatórios de Transporte (Decreto Presidencial 71/25)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Matrícula da Viatura
                      </label>
                      <input
                        type="text"
                        required
                        value={vehiclePlateNumber}
                        onChange={(e) => setVehiclePlateNumber(e.target.value.toUpperCase())}
                        placeholder="Ex: LD-01-23-AA"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 font-mono text-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Local de Carga
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={loadingAddress}
                          onChange={(e) => setLoadingAddress(e.target.value)}
                          placeholder="Endereço de partida"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm"
                        />
                        <input
                          type="text"
                          required
                          value={loadingCity}
                          onChange={(e) => setLoadingCity(e.target.value)}
                          placeholder="Cidade"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Local de Descarga
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={unloadingAddress}
                          onChange={(e) => setUnloadingAddress(e.target.value)}
                          placeholder="Endereço de destino"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm"
                        />
                        <input
                          type="text"
                          required
                          value={unloadingCity}
                          onChange={(e) => setUnloadingCity(e.target.value)}
                          placeholder="Cidade"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Data e Hora de Início do Transporte
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={loadingDateTime}
                        onChange={(e) => setLoadingDateTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Previsão de Chegada
                      </label>
                      <input
                        type="datetime-local"
                        value={unloadingDateTime}
                        onChange={(e) => setUnloadingDateTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {(docType === 'NC' || docType === 'ND') && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    Documento de Origem Retificado (Obrigatório por lei)
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
                      <div className="grid grid-cols-1 sm:grid-cols-6 xl:grid-cols-12 gap-2.5 items-center">
                        <div className="sm:col-span-2 xl:col-span-3">
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Artigo / Código
                          </label>
                          <select
                            value={line.productCode}
                            onChange={(e) => handleSelectProduct(idx, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold"
                          >
                            <option value={line.productCode}>{line.productCode}</option>
                            {products.map((p) => {
                              const isSrv = p.product_type === 'S' || !p.is_stockable;
                              const stock = getStockByCode(p.code);
                              return (
                                <option key={p.id} value={p.code}>
                                  {p.code} — {p.name} ({isSrv ? 'Serviço' : `Stock: ${stock} un.`})
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="sm:col-span-4 xl:col-span-4">
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

                        <div className="sm:col-span-2 xl:col-span-2">
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

                        <div className="sm:col-span-2 xl:col-span-1">
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

                        <div className="sm:col-span-1 xl:col-span-1">
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

                        <div className="sm:col-span-1 xl:col-span-1 flex justify-end sm:justify-center sm:pt-4">
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

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 text-xs">
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
                          <span>
                            {line.isService
                              ? `Prestação de Serviços (sujeito a Retenção de ${defaultWithholdingRate.toString().replace('.', ',')}%)`
                              : 'Marcar como Serviço (Sem dedução de stock)'}
                          </span>
                        </label>

                        {line.isService ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Serviço (Isento de Stock)
                          </span>
                        ) : (
                          (() => {
                            const avail = getStockByCode(line.productCode);
                            if (avail <= 0) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  <AlertCircle className="w-3 h-3" /> Esgotado em armazém (0 un.)
                                </span>
                              );
                            }
                            if (line.quantity > avail) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <AlertCircle className="w-3 h-3" /> Stock insuficiente (Disp: {avail} un.)
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Em Stock ({avail} un.)
                              </span>
                            );
                          })()
                        )}
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
                  Apuramento Tributário
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Incidência Líquida:</span>
                    <KzAmount value={netSubtotal} />
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>IVA Liquidado:</span>
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
                        Aplicar Retenção na Fonte ({defaultWithholdingRate.toString().replace('.', ',')}%)
                      </span>
                    </label>
                    {applyWithholding && (
                      <div className="flex justify-between text-rose-600 font-semibold mt-1.5">
                        <span>
                          Retenção ({defaultWithholdingRate.toString().replace('.', ',')}% s/ Serviços):
                        </span>
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

                {stockErrors.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-100">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Emissão Bloqueada por Ruptura de Stock</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {stockErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400">
                      Dê entrada de mercadoria no módulo de <strong>Gestão de Stock</strong> ou ajuste as quantidades antes de faturar.
                    </p>
                  </div>
                )}

                {serviceTransportErrors.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Serviços em Documentos de Transporte</span>
                    </div>
                    <p className="text-[11px]">
                      A legislação fiscal proíbe estritamente a emissão de Guias de Transporte (GT) ou Remessa (GR) para serviços.
                    </p>
                  </div>
                )}

                {issueMutation.isError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    Erro ao emitir: {(issueMutation.error as any)?.response?.data?.error || (issueMutation.error as any)?.response?.data?.detail || 'Falha na validação'}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={issueMutation.isPending || !canSubmitInvoice}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>
                    {issueMutation.isPending
                      ? 'A assinar criptograficamente...'
                      : !canSubmitInvoice && stockErrors.length > 0
                      ? 'Stock Insuficiente (Bloqueado)'
                      : !canSubmitInvoice && serviceTransportErrors.length > 0
                      ? 'Serviços Inválidos em GT (Bloqueado)'
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

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-left text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md">
                    <tr className="text-xs font-bold uppercase text-slate-500">
                      <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Tipo Doc</th>
                      <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Código Série</th>
                      <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Ano Fiscal</th>
                      <th className="sticky top-0 py-2.5 px-3 text-right bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Última Sequência</th>
                      <th className="sticky top-0 py-2.5 px-3 text-center bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">Estado</th>
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
                Administração Geral Tributária.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Exercício Fiscal
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={saftYear}
                    onChange={(e) => setSaftYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Mês (opcional)
                  </label>
                  <select
                    value={saftMonth}
                    onChange={(e) =>
                      setSaftMonth(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 text-xs font-mono"
                  >
                    <option value="">Ano completo</option>
                    {MONTHS.map((label, idx) => (
                      <option key={label} value={idx + 1}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleDownloadSaft}
                  disabled={saftLoading}
                  className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{saftLoading ? 'A gerar SAF-T...' : 'Exportar SAF-T XML'}</span>
                </button>

                <button
                  onClick={handleValidateSaft}
                  disabled={isValidatingSaft || saftLoading}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{isValidatingSaft ? 'A validar...' : 'Validar Schema'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Mapas Oficiais de Apuramento de IVA
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadTaxPdf}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4 text-rose-500" />
                    <span>Mapa de Impostos (PDF)</span>
                  </button>

                  <button
                    onClick={handleDownloadTaxExcel}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4 text-emerald-600" />
                    <span>Mapa de Impostos (Excel)</span>
                  </button>
                </div>
              </div>

              {saftValidationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    saftValidationResult.isValid
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {saftValidationResult.isValid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Ficheiro SAF-T válido contra o Schema XSD oficial.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        <span>Erros de conformidade detetados no SAF-T:</span>
                      </>
                    )}
                  </div>
                  {saftValidationResult.errors && saftValidationResult.errors.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] pl-1 space-y-0.5">
                      {saftValidationResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
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
                    <div className="flex flex-wrap justify-between items-center gap-1">
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {r.displayName}
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        Taxa Padrão: {r.standardRate}%
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between text-slate-500 text-[11px] gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-3 sm:p-6 relative my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="no-print absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="invoice-a4 bg-white text-slate-900 p-4 sm:p-8 rounded-lg shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div className="flex items-start gap-3">
                  {activeTenant?.logo_data_url && (
                    <img
                      src={activeTenant.logo_data_url}
                      alt="Logótipo"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-contain border border-slate-200 bg-white p-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold text-emerald-800">
                      {activeTenant?.trade_name || activeTenant?.name || 'KUDIBA COMÉRCIO GERAL, LDA'}
                    </h3>
                    {activeTenant?.trade_name &&
                      activeTenant?.name &&
                      activeTenant.trade_name !== activeTenant.name && (
                        <p className="text-xs font-semibold text-slate-700">{activeTenant.name}</p>
                      )}
                    <p className="text-xs text-slate-600">
                      {activeTenant?.address_detail || selectedInvoice.issuerAddress}
                    </p>
                    <p className="text-xs text-slate-600">
                      {activeTenant?.city || selectedInvoice.issuerCity}
                      {activeTenant?.province ? ` — ${activeTenant.province}` : ''},{' '}
                      {activeTenant?.country === 'AO' || !activeTenant?.country
                        ? 'Angola'
                        : activeTenant.country}
                    </p>
                    <p className="text-xs font-mono text-slate-700 font-bold mt-1">
                      NIF: {activeTenant?.nif || selectedInvoice.issuerNif}
                      {activeTenant?.commercial_registry
                        ? ` | Reg. Com.: ${activeTenant.commercial_registry}`
                        : ''}
                    </p>
                    {activeTenant?.share_capital && (
                      <p className="text-[11px] text-slate-500">
                        Capital Social: {activeTenant.share_capital}
                      </p>
                    )}
                    {(activeTenant?.phone || activeTenant?.email || activeTenant?.website) && (
                      <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                        {[activeTenant?.phone, activeTenant?.email, activeTenant?.website]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="sm:text-right shrink-0">
                  <h4 className="text-base sm:text-lg font-extrabold text-slate-900">
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

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs text-left">
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
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{line.productCode}</td>
                        <td className="py-2.5 px-3 font-semibold">{line.description}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{line.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          <KzAmount value={line.unitPrice} />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{line.taxRate}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          <KzAmount value={line.lineTotal || line.quantity * line.unitPrice} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-6">
                <div className="w-full sm:w-64 space-y-1.5 text-xs">
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
                      <span>
                        Retenção na Fonte ({defaultWithholdingRate.toString().replace('.', ',')}%):
                      </span>
                      <KzAmount value={selectedInvoice.withholdingTotal} />
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Documento:</span>
                    <KzAmount value={selectedInvoice.grossTotal} />
                  </div>
                </div>
              </div>

              {activeTenant?.bank_accounts && activeTenant.bank_accounts.length > 0 && (
                <div className="border-t border-slate-200 pt-3 mb-3 text-[11px] text-slate-600">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                    Coordenadas Bancárias para Pagamento
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {activeTenant.bank_accounts.map((acc, idx) => (
                      <div key={idx} className="font-mono text-[11px] break-all">
                        <span className="font-bold text-slate-700">{acc.bank_name}:</span>{' '}
                        {acc.iban} ({acc.currency || 'AOA'})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-mono font-bold text-slate-700">
                  {selectedInvoice.validationChars}-Processado por programa validado nº{' '}
                  {activeTenant?.agt_cert_number || '999/AGT/2026'} Kudiba ERP
                </p>
                <p>
                  {activeTenant?.invoice_footer_notes ||
                    'Os bens/serviços foram colocados à disposição do adquirente na data do documento.'}
                </p>
              </div>
            </div>

            <div className="no-print flex flex-wrap items-center justify-end gap-2 sm:gap-3 mt-4">
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
              A regulamentação fiscal exige que documentos fiscais assinados sejam retificados via emissão de uma{' '}
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
