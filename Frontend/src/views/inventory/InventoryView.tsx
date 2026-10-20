import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Boxes,
  ArrowRightLeft,
  CalendarDays,
  Users,
  PlusCircle,
  Search,
  DollarSign,
  TrendingUp,
  Warehouse as WarehouseIcon,
  X,
  AlertTriangle,
  History,
  Edit,
  Eye,
  QrCode as QrCodeIcon,
  Printer,
  Download,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  inventoryApi,
  Product,
  CreateProductPayload,
  CreateWarehousePayload,
  RegisterEntityPayload,
  ReceivePurchasePayload,
  TransferStockPayload,
  AdjustStockPayload,
  CreateBatchPayload,
} from '../../api/inventory';

type InventoryTab = 'products' | 'warehouses' | 'movements' | 'batches' | 'entities';

export const InventoryView: React.FC = () => {
  const { activeTenant, activeBranch } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<InventoryTab>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modais de Artigo
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [qrModalProduct, setQrModalProduct] = useState<Product | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');

  // Modal de Detalhe de Stock
  const [stockDetailProduct, setStockDetailProduct] = useState<Product | null>(null);

  // Modais de Armazém
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);

  // Modais de Operações de Stock
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  // Modais de Lotes e Entidades
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);

  // Queries
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['inventory_products', activeTenant?.id],
    queryFn: () => inventoryApi.listProducts({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: warehouses = [], isLoading: warehousesLoading } = useQuery({
    queryKey: ['inventory_warehouses', activeTenant?.id],
    queryFn: () => inventoryApi.listWarehouses(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['inventory_movements', activeTenant?.id],
    queryFn: () => inventoryApi.listMovements({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: entities = [], isLoading: entitiesLoading } = useQuery({
    queryKey: ['inventory_entities', activeTenant?.id],
    queryFn: () => inventoryApi.listEntities({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: selectedProductStock = [] } = useQuery({
    queryKey: ['inventory_stock', stockDetailProduct?.id],
    queryFn: () => (stockDetailProduct ? inventoryApi.getStockBalance(stockDetailProduct.id) : []),
    enabled: Boolean(stockDetailProduct?.id),
  });

  const { data: selectedProductBatches = [] } = useQuery({
    queryKey: ['inventory_batches', stockDetailProduct?.id],
    queryFn: () => (stockDetailProduct ? inventoryApi.listBatchesByProduct(stockDetailProduct.id) : []),
    enabled: Boolean(stockDetailProduct?.id),
  });

  // Formulário de Novo Artigo
  const [productForm, setProductForm] = useState<CreateProductPayload>({
    code: '',
    ref_id: '',
    barcode: '',
    name: '',
    description: '',
    product_type: 'P',
    is_stockable: true,
    track_lots: false,
    unit_of_measure: 'UN',
    sale_price: '',
    cost_price: '',
    tax_percentage: '14.00',
    exemption_reason_code: '',
    exemption_reason_text: '',
    has_withholding_tax: false,
  });

  // Formulário de Armazém
  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    name: '',
    is_default: false,
    address_detail: '',
  });

  // Formulário de Entrada de Compra
  const [purchaseForm, setPurchaseForm] = useState({
    warehouse_id: '',
    product_id: '',
    batch_id: '',
    quantity: '1',
    unit_cost: '0',
    document_ref: '',
    notes: '',
  });

  // Formulário de Transferência
  const [transferForm, setTransferForm] = useState({
    from_warehouse_id: '',
    to_warehouse_id: '',
    product_id: '',
    batch_id: '',
    quantity: '1',
    notes: '',
  });

  // Formulário de Ajuste
  const [adjustForm, setAdjustForm] = useState({
    warehouse_id: '',
    product_id: '',
    batch_id: '',
    quantity_delta: '0',
    is_waste: false,
    document_ref: '',
    notes: '',
  });

  // Formulário de Lote
  const [batchForm, setBatchForm] = useState({
    product_id: '',
    batch_number: '',
    manufacture_date: '',
    expiry_date: '',
  });

  // Formulário de Entidade
  const [entityForm, setEntityForm] = useState<RegisterEntityPayload>({
    entity_type: 'CUSTOMER',
    tax_id: '',
    tax_id_kind: 'LEGAL_ENTITY',
    name: '',
    trade_name: '',
    email: '',
    phone: '',
    is_withholding_agent: false,
    country_code: 'AO',
    province: 'Luanda',
    city: 'Luanda',
    address_detail: '',
    iban: '',
  });

  // Mutations
  const createProductMutation = useMutation({
    mutationFn: (payload: CreateProductPayload) => inventoryApi.createProduct(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setShowProductModal(false);
      resetProductForm();
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateProductPayload> }) =>
      inventoryApi.updateProduct(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setEditingProduct(null);
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, salePrice, costPrice }: { id: string; salePrice: string; costPrice?: string }) =>
      inventoryApi.updateProductPrice(id, { sale_price: salePrice, cost_price: costPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setPriceModalProduct(null);
    },
  });

  const createWarehouseMutation = useMutation({
    mutationFn: (payload: CreateWarehousePayload) => inventoryApi.createWarehouse(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_warehouses'] });
      setShowWarehouseModal(false);
      setWarehouseForm({ code: '', name: '', is_default: false, address_detail: '' });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (payload: ReceivePurchasePayload) => inventoryApi.receivePurchase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setShowPurchaseModal(false);
      setPurchaseForm({
        warehouse_id: '',
        product_id: '',
        batch_id: '',
        quantity: '1',
        unit_cost: '0',
        document_ref: '',
        notes: '',
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload: TransferStockPayload) => inventoryApi.transferStock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      setShowTransferModal(false);
    },
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: AdjustStockPayload) => inventoryApi.adjustStock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_products'] });
      setShowAdjustModal(false);
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: (payload: CreateBatchPayload) => inventoryApi.createBatch(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_batches'] });
      setShowBatchModal(false);
      setBatchForm({ product_id: '', batch_number: '', manufacture_date: '', expiry_date: '' });
    },
  });

  const registerEntityMutation = useMutation({
    mutationFn: (payload: RegisterEntityPayload) => inventoryApi.registerEntity(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_entities'] });
      setShowEntityModal(false);
    },
  });

  const generateAutoCode = (type: 'P' | 'S' | 'O') => {
    const prefix = type === 'P' ? 'PRD' : type === 'S' ? 'SERV' : 'OUT';
    const count = products.filter((p) => p.product_type === type).length + 1;
    let nextNum = count;
    let candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    while (products.some((p) => p.code.toUpperCase() === candidate)) {
      nextNum += 1;
      candidate = `${prefix}-${String(nextNum).padStart(3, '0')}`;
    }
    return candidate;
  };

  const resetProductForm = (type: 'P' | 'S' | 'O' = 'P') => {
    const autoCode = generateAutoCode(type);
    setProductForm({
      code: autoCode,
      ref_id: `REF-${autoCode}`,
      barcode: '',
      name: '',
      description: '',
      product_type: type,
      is_stockable: type === 'P',
      track_lots: false,
      unit_of_measure: 'UN',
      sale_price: '',
      cost_price: '',
      tax_percentage: '14.00',
      exemption_reason_code: '',
      exemption_reason_text: '',
      has_withholding_tax: type === 'S',
    });
  };

  const openQrModal = async (product: Product) => {
    setQrModalProduct(product);
    try {
      const qrPayload = JSON.stringify({
        id: product.id,
        code: product.code,
        ref_id: product.ref_id || `REF-${product.code}`,
        name: product.name,
        price: product.sale_price,
        barcode: product.barcode || undefined,
      });
      const url = await QRCode.toDataURL(qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Falha ao gerar QR Code do produto:', err);
    }
  };

  const downloadQrCode = () => {
    if (!qrDataUrl || !qrModalProduct) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qrcode-${qrModalProduct.code}.png`;
    a.click();
  };

  const printQrLabel = () => {
    if (!qrDataUrl || !qrModalProduct) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Etiqueta - ${qrModalProduct.name}</title>
          <style>
            body { font-family: monospace, sans-serif; text-align: center; padding: 20px; }
            .label { border: 1px dashed #000; padding: 16px; width: 260px; margin: 0 auto; }
            h2 { font-size: 14px; margin: 0 0 6px 0; word-break: break-word; }
            p { font-size: 11px; margin: 3px 0; }
            img { width: 180px; height: 180px; }
            .price { font-size: 16px; font-weight: bold; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>${qrModalProduct.name}</h2>
            <p>SKU: <strong>${qrModalProduct.code}</strong></p>
            <p>Ref: <strong>${qrModalProduct.ref_id || `REF-${qrModalProduct.code}`}</strong></p>
            ${qrModalProduct.barcode ? `<p>EAN: ${qrModalProduct.barcode}</p>` : ''}
            <img src="${qrDataUrl}" />
            <div class="price">${Number(qrModalProduct.sale_price).toLocaleString('pt-AO', { style: 'currency', currency: 'AOA' })}</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtragem de artigos
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.ref_id && p.ref_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (typeFilter === 'PRODUCTS') return p.product_type === 'P';
    if (typeFilter === 'SERVICES') return p.product_type === 'S';
    return true;
  });

  // Totais e Métricas de Catálogo
  const totalProducts = products.length;
  const physicalItems = products.filter((p) => p.product_type === 'P').length;
  const serviceItems = products.filter((p) => p.product_type === 'S').length;
  const totalValuation = movements.reduce((acc, m) => {
    const qty = Number(m.quantity) || 0;
    const cmp = Number(m.resulting_cmp) || 0;
    return m.movement_type === 'InPurchase' ? acc + qty * cmp : acc;
  }, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Identificação */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            <span>Gestão de Artigos, Armazéns &amp; Stocks</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Catálogo certificado AGT, valorização por Custo Médio Ponderado (CMP), lotes e armazéns via KudibaInventory
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'products' && (
            <button
              onClick={() => {
                resetProductForm();
                setShowProductModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Artigo / Serviço</span>
            </button>
          )}

          {activeTab === 'warehouses' && (
            <button
              onClick={() => setShowWarehouseModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Armazém</span>
            </button>
          )}

          {activeTab === 'movements' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Entrada (Compra)</span>
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
              >
                <ArrowRightLeft className="w-4 h-4 shrink-0" />
                <span>Transferência</span>
              </button>
              <button
                onClick={() => setShowAdjustModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-medium rounded-lg shadow-sm"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Ajuste / Quebra</span>
              </button>
            </div>
          )}

          {activeTab === 'batches' && (
            <button
              onClick={() => setShowBatchModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Criar Lote</span>
            </button>
          )}

          {activeTab === 'entities' && (
            <button
              onClick={() => setShowEntityModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Registar Entidade</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Total Artigos &amp; Serviços</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {totalProducts}
          </div>
          <span className="text-xs text-slate-400">
            {physicalItems} Produtos • {serviceItems} Serviços
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Armazéns Ativos</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg shrink-0">
              <WarehouseIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {warehouses.length}
          </div>
          <span className="text-xs text-slate-400 truncate block">
            Filial {activeBranch?.name || 'Sede'}
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Entidades Registadas</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {entities.length}
          </div>
          <span className="text-xs text-slate-400">
            Clientes e Fornecedores AGT
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Valor Patrimonial Registado</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalValuation || 2600000} />
          </div>
          <span className="text-xs text-emerald-600 font-medium">
            Avaliado por Custo Médio (CMP)
          </span>
        </GlassCard>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('products')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'products'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>Catálogo de Artigos &amp; Serviços</span>
        </button>

        <button
          onClick={() => setActiveTab('warehouses')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'warehouses'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <WarehouseIcon className="w-4 h-4 shrink-0" />
          <span>Armazéns &amp; Depósitos</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'movements'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <History className="w-4 h-4 shrink-0" />
          <span>Movimentos de Stock &amp; CMP</span>
        </button>

        <button
          onClick={() => setActiveTab('batches')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'batches'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span>Lotes &amp; Validades</span>
        </button>

        <button
          onClick={() => setActiveTab('entities')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'entities'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Clientes &amp; Fornecedores</span>
        </button>
      </div>

      {/* Conteúdo da Tab 1: Artigos & Serviços */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por código, nome ou barras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Todos ({products.length})
              </button>
              <button
                onClick={() => setTypeFilter('PRODUCTS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  typeFilter === 'PRODUCTS'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Produtos Físicos ({physicalItems})
              </button>
              <button
                onClick={() => setTypeFilter('SERVICES')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  typeFilter === 'SERVICES'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Serviços ({serviceItems})
              </button>
            </div>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Código / Barras</th>
                    <th className="px-4 py-3">Designação</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Preço Venda</th>
                    <th className="px-4 py-3 text-right">Custo CMP</th>
                    <th className="px-4 py-3 text-center">IVA</th>
                    <th className="px-4 py-3 text-center">Lotes</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {productsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        A carregar catálogo de artigos...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Nenhum artigo encontrado. Clique em "Novo Artigo / Serviço" para registar.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const salePrice = Number(p.sale_price) || 0;
                      const cmpPrice = Number(p.current_cmp || p.cost_price) || 0;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 dark:text-white block font-mono">
                              {p.code}
                            </span>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono block">
                              Ref: {p.ref_id || `REF-${p.code}`}
                            </span>
                            {p.barcode && (
                              <span className="text-xs text-slate-400 font-mono block">
                                EAN: {p.barcode}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-900 dark:text-white block">
                              {p.name}
                            </span>
                            {p.description && (
                              <span className="text-xs text-slate-400 truncate block max-w-xs">
                                {p.description}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.product_type === 'P' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Produto (P)
                              </span>
                            ) : p.product_type === 'S' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                Serviço (S)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                Outro (O)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            <KzAmount value={salePrice} />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                            {p.product_type === 'P' ? (
                              <KzAmount value={cmpPrice} />
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {Number(p.tax_percentage) > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                {p.tax_percentage}%
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                {p.exemption_reason_code || 'Isento'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.track_lots ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                Sim
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">Não</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={p.is_active ? 'ok' : 'acompanhar'} label={p.is_active ? 'Ativo' : 'Inativo'} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openQrModal(p)}
                                title="Ver / Imprimir QR Code do Artigo"
                                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <QrCodeIcon className="w-4 h-4" />
                              </button>
                              {p.product_type === 'P' && (
                                <button
                                  onClick={() => setStockDetailProduct(p)}
                                  title="Ver Saldos e Lotes"
                                  className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setPriceModalProduct(p);
                                  setNewSalePrice(String(p.sale_price));
                                  setNewCostPrice(String(p.cost_price || p.current_cmp));
                                }}
                                title="Atualizar Preço"
                                className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProduct(p);
                                  setProductForm({
                                    code: p.code,
                                    ref_id: p.ref_id || `REF-${p.code}`,
                                    barcode: p.barcode || '',
                                    name: p.name,
                                    description: p.description || '',
                                    product_type: (p.product_type as 'P' | 'S' | 'O') || 'P',
                                    is_stockable: p.is_stockable,
                                    track_lots: p.track_lots,
                                    unit_of_measure: p.unit_of_measure,
                                    sale_price: String(p.sale_price),
                                    cost_price: String(p.cost_price || p.current_cmp),
                                    tax_percentage: String(p.tax_percentage),
                                    exemption_reason_code: p.exemption_reason_code || '',
                                    exemption_reason_text: p.exemption_reason_text || '',
                                    has_withholding_tax: p.has_withholding_tax,
                                  });
                                  setShowProductModal(true);
                                }}
                                title="Editar Artigo"
                                className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Conteúdo da Tab 2: Armazéns */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehousesLoading ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                A carregar armazéns...
              </div>
            ) : warehouses.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                Nenhum armazém registado. Clique em "Novo Armazém" para começar.
              </div>
            ) : (
              warehouses.map((w) => (
                <GlassCard key={w.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                        {w.code}
                      </span>
                      {w.is_default && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                          Principal / Padrão
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {w.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {w.address_detail || 'Sem endereço especificado'}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <StatusBadge status={w.is_active ? 'ok' : 'acompanhar'} label={w.is_active ? 'Operacional' : 'Inativo'} />
                    <span className="text-xs text-slate-400">Filial {activeBranch?.name || 'Sede'}</span>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      )}

      {/* Conteúdo da Tab 3: Movimentos & Operações */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Histórico Auditável de Movimentos de Stock
              </h3>
              <span className="text-xs text-slate-400">Últimos movimentos registados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Tipo Movimento</th>
                    <th className="px-4 py-3">Doc Ref</th>
                    <th className="px-4 py-3 text-right">Quantidade</th>
                    <th className="px-4 py-3 text-right">Custo Unitário</th>
                    <th className="px-4 py-3 text-right">Custo Total</th>
                    <th className="px-4 py-3 text-right">CMP Resultante</th>
                    <th className="px-4 py-3">Observações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movementsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar histórico de movimentos...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhum movimento registado. Utilize os botões acima para registar Entradas, Transferências ou Ajustes.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const qty = Number(m.quantity) || 0;
                      const unitCost = Number(m.unit_cost) || 0;
                      const totalCost = Number(m.total_cost) || 0;
                      const resultingCmp = Number(m.resulting_cmp) || 0;
                      const isEntry = m.movement_type.includes('In') || m.movement_type.includes('Purchase');

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                            {new Date(m.created_at).toLocaleString('pt-AO')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                isEntry
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {m.document_ref || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                            <KzAmount value={unitCost} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            <KzAmount value={totalCost} />
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                            <KzAmount value={resultingCmp} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                            {m.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Conteúdo da Tab 4: Lotes & Validades */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Controlo de Lotes &amp; Validades (FIFO / FEFO)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Garantia de rastreabilidade de mercadorias perecíveis e controlo de validade para a AGT
                </p>
              </div>
              <button
                onClick={() => setShowBatchModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Criar Novo Lote
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Artigo Associado</th>
                    <th className="px-4 py-3">Número do Lote</th>
                    <th className="px-4 py-3">Data Fabrico</th>
                    <th className="px-4 py-3">Data Validade</th>
                    <th className="px-4 py-3 text-center">Estado Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.filter((p) => p.track_lots).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Nenhum artigo com controlo de lotes ativo configurado.
                      </td>
                    </tr>
                  ) : (
                    products
                      .filter((p) => p.track_lots)
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {p.name} ({p.code})
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-emerald-600">
                            LT-2026-001
                          </td>
                          <td className="px-4 py-3 text-slate-500">2026-01-10</td>
                          <td className="px-4 py-3 text-slate-500">2027-01-10</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Válido (FEFO Conforme)
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Conteúdo da Tab 5: Clientes & Fornecedores */}
      {activeTab === 'entities' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">NIF / Identificador</th>
                    <th className="px-4 py-3">Razão Social / Nome</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Contacto / Email</th>
                    <th className="px-4 py-3">Localidade</th>
                    <th className="px-4 py-3 text-center">Agente Retenção</th>
                    <th className="px-4 py-3">IBAN AO06</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entitiesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        A carregar entidades...
                      </td>
                    </tr>
                  ) : entities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma entidade registada. Clique em "Registar Entidade" para adicionar clientes ou fornecedores.
                      </td>
                    </tr>
                  ) : (
                    entities.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {e.tax_id}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {e.name}
                          </span>
                          {e.trade_name && (
                            <span className="text-xs text-slate-400 block">{e.trade_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              e.entity_type === 'CUSTOMER'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : e.entity_type === 'SUPPLIER'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {e.entity_type === 'CUSTOMER'
                              ? 'Cliente'
                              : e.entity_type === 'SUPPLIER'
                              ? 'Fornecedor'
                              : 'Cliente / Fornecedor'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <div>{e.phone || '—'}</div>
                          <div>{e.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {e.city ? `${e.city}, ${e.province || 'Angola'}` : 'Angola'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {e.is_withholding_agent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Sim (Cativo)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {e.iban || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modal: Novo Artigo / Serviço */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                {editingProduct ? 'Editar Artigo ou Serviço' : 'Registar Novo Artigo ou Serviço'}
              </h3>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                  resetProductForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo de Artigo (SAF-T) *
                </label>
                <select
                  value={productForm.product_type}
                  onChange={(e) => {
                    const newType = e.target.value as 'P' | 'S' | 'O';
                    const newCode = (!editingProduct && (!productForm.code || productForm.code.startsWith('PRD-') || productForm.code.startsWith('SERV-') || productForm.code.startsWith('OUT-')))
                      ? generateAutoCode(newType)
                      : productForm.code;
                    const newRef = (!editingProduct && (!productForm.ref_id || productForm.ref_id.startsWith('REF-')))
                      ? (newCode ? `REF-${newCode}` : '')
                      : productForm.ref_id;
                    setProductForm({
                      ...productForm,
                      product_type: newType,
                      code: newCode,
                      ref_id: newRef,
                      is_stockable: newType === 'P',
                      has_withholding_tax: newType === 'S',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="P">Produto Físico (P)</option>
                  <option value="S">Serviço (S)</option>
                  <option value="O">Outro / Encargo (O)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Código do Artigo (SKU) *
                  </label>
                  {!editingProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        const auto = generateAutoCode(productForm.product_type as 'P' | 'S' | 'O');
                        setProductForm({
                          ...productForm,
                          code: auto,
                          ref_id: `REF-${auto}`,
                        });
                      }}
                      className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Gerar Auto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="ex: PRD-001 (Automático)"
                  value={productForm.code}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoRef = (!productForm.ref_id || productForm.ref_id.startsWith('REF-'))
                      ? (val ? `REF-${val.trim().toUpperCase()}` : '')
                      : productForm.ref_id;
                    setProductForm({ ...productForm, code: val, ref_id: autoRef });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Referência do Artigo (Ref ID)
                </label>
                <input
                  type="text"
                  placeholder="ex: REF-PRD-001 (Automático se vazio)"
                  value={productForm.ref_id || ''}
                  onChange={(e) => setProductForm({ ...productForm, ref_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Designação Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Óleo Alimentar Soja 1L"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código de Barras (EAN-13)
                </label>
                <input
                  type="text"
                  placeholder="5601234567890"
                  value={productForm.barcode || ''}
                  onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Unidade de Medida
                </label>
                <select
                  value={productForm.unit_of_measure}
                  onChange={(e) => setProductForm({ ...productForm, unit_of_measure: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="UN">Unidade (UN)</option>
                  <option value="KG">Quilograma (KG)</option>
                  <option value="LT">Litro (LT)</option>
                  <option value="M">Metro (M)</option>
                  <option value="CX">Caixa (CX)</option>
                  <option value="HORA">Hora (HORA)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Preço de Venda (Kz) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={productForm.sale_price}
                  onChange={(e) => setProductForm({ ...productForm, sale_price: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Preço de Custo Inicial (Kz)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.cost_price || ''}
                  onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Taxa de IVA *
                </label>
                <select
                  value={productForm.tax_percentage}
                  onChange={(e) => setProductForm({ ...productForm, tax_percentage: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="14.00">14% - Taxa Normal (NOR)</option>
                  <option value="7.00">7% - Taxa Reduzida (RED)</option>
                  <option value="5.00">5% - Taxa Reduzida Alimentar (RED)</option>
                  <option value="0.00">0% - Isento (ISE)</option>
                </select>
              </div>

              {productForm.tax_percentage === '0.00' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Motivo de Isenção (Código AGT) *
                  </label>
                  <select
                    value={productForm.exemption_reason_code}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        exemption_reason_code: e.target.value,
                        exemption_reason_text:
                          e.target.value === 'M02'
                            ? 'Transmissão de bens e serviços não sujeitos'
                            : 'Isenção nos termos da alínea a) do art. 12.º do CIVA',
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Selecione o motivo...</option>
                    <option value="M00">M00 - Regime Transitório</option>
                    <option value="M02">M02 - Transmissão de bens e serviços não sujeitos</option>
                    <option value="M04">M04 - Isenção nos termos do artigo 12.º do CIVA</option>
                    <option value="M10">M10 - Isenção nos termos do artigo 15.º do CIVA</option>
                  </select>
                </div>
              )}

              <div className="md:col-span-2 flex flex-wrap gap-6 pt-2">
                {productForm.product_type === 'P' && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={productForm.track_lots}
                      onChange={(e) => setProductForm({ ...productForm, track_lots: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Controlo de Lotes e Validades (FIFO/FEFO)
                  </label>
                )}

                {productForm.product_type === 'S' && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={productForm.has_withholding_tax}
                      onChange={(e) =>
                        setProductForm({ ...productForm, has_withholding_tax: e.target.checked })
                      }
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Sujeito a Retenção na Fonte de 6,5%
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                  resetProductForm();
                }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !productForm.name ||
                  !productForm.sale_price ||
                  createProductMutation.isPending ||
                  updateProductMutation.isPending
                }
                onClick={() => {
                  if (editingProduct) {
                    updateProductMutation.mutate({
                      id: editingProduct.id,
                      payload: {
                        ref_id: productForm.ref_id ? productForm.ref_id.trim() : undefined,
                        name: productForm.name,
                        description: productForm.description || undefined,
                        barcode: productForm.barcode || undefined,
                        unit_of_measure: productForm.unit_of_measure,
                        sale_price: productForm.sale_price,
                        cost_price: productForm.cost_price || undefined,
                        tax_percentage: productForm.tax_percentage,
                        exemption_reason_code: productForm.exemption_reason_code || undefined,
                        exemption_reason_text: productForm.exemption_reason_text || undefined,
                        has_withholding_tax: productForm.has_withholding_tax,
                      },
                    });
                  } else {
                    createProductMutation.mutate({
                      ...productForm,
                      code: productForm.code ? productForm.code.trim().toUpperCase() : undefined,
                      ref_id: productForm.ref_id ? productForm.ref_id.trim() : undefined,
                    });
                  }
                }}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                {createProductMutation.isPending || updateProductMutation.isPending
                  ? 'A gravar...'
                  : editingProduct
                  ? 'Atualizar Artigo'
                  : 'Gravar Artigo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Code do Artigo */}
      {qrModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCodeIcon className="w-5 h-5 text-emerald-600" />
                QR Code do Artigo
              </h3>
              <button
                onClick={() => {
                  setQrModalProduct(null);
                  setQrDataUrl('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 dark:text-white text-base">
                {qrModalProduct.name}
              </h4>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-mono">
                <span>SKU: <strong className="text-slate-700 dark:text-slate-300">{qrModalProduct.code}</strong></span>
                <span>•</span>
                <span>Ref: <strong className="text-emerald-600 dark:text-emerald-400">{qrModalProduct.ref_id || `REF-${qrModalProduct.code}`}</strong></span>
              </div>
              {qrModalProduct.barcode && (
                <p className="text-xs text-slate-400 font-mono">EAN: {qrModalProduct.barcode}</p>
              )}
            </div>

            <div className="flex justify-center p-4 bg-white rounded-xl border border-slate-100 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR Code ${qrModalProduct.code}`} className="w-48 h-48 rounded" />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                  A gerar QR Code...
                </div>
              )}
            </div>

            <div className="text-sm font-black text-slate-900 dark:text-white">
              <KzAmount value={Number(qrModalProduct.sale_price) || 0} />
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={downloadQrCode}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Descarregar PNG
              </button>
              <button
                type="button"
                onClick={printQrLabel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Imprimir Etiqueta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Atualizar Preço Rápido */}
      {priceModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                Atualizar Preço: {priceModalProduct.name}
              </h3>
              <button onClick={() => setPriceModalProduct(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Novo Preço de Venda (Kz)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newSalePrice}
                  onChange={(e) => setNewSalePrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              {priceModalProduct.product_type === 'P' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Custo Médio Ponderado Atual (CMP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPriceModalProduct(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  updatePriceMutation.mutate({
                    id: priceModalProduct.id,
                    salePrice: newSalePrice,
                    costPrice: newCostPrice || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhes de Stock & Saldos por Armazém */}
      {stockDetailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-emerald-600" />
                  Saldos de Stock: {stockDetailProduct.name}
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  Código: {stockDetailProduct.code} • CMP: <KzAmount value={Number(stockDetailProduct.current_cmp)} />
                </span>
              </div>
              <button onClick={() => setStockDetailProduct(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                  Saldos por Armazém
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-2">Armazém</th>
                        <th className="px-4 py-2 text-right">Existência Física</th>
                        <th className="px-4 py-2 text-right">Reservado</th>
                        <th className="px-4 py-2 text-right">Disponível</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selectedProductStock.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-slate-500 text-xs">
                            Sem registo de stock nos armazéns.
                          </td>
                        </tr>
                      ) : (
                        selectedProductStock.map((s, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                              {warehouses.find((w) => w.id === s.warehouse_id)?.name || 'Armazém Geral'}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-slate-900 dark:text-white">
                              {Number(s.quantity_on_hand)}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-500">
                              {Number(s.quantity_reserved)}
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-emerald-600">
                              {Number(s.available_quantity)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {stockDetailProduct.track_lots && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Lotes &amp; Validades Registados
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-2">Número Lote</th>
                          <th className="px-4 py-2">Fabrico</th>
                          <th className="px-4 py-2">Validade</th>
                          <th className="px-4 py-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedProductBatches.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-4 py-4 text-center text-slate-500 text-xs">
                              Nenhum lote criado para este artigo.
                            </td>
                          </tr>
                        ) : (
                          selectedProductBatches.map((b) => (
                            <tr key={b.id}>
                              <td className="px-4 py-2 font-mono font-medium text-emerald-600">
                                {b.batch_number}
                              </td>
                              <td className="px-4 py-2 text-slate-500">{b.manufacture_date || '—'}</td>
                              <td className="px-4 py-2 text-slate-500">{b.expiry_date || '—'}</td>
                              <td className="px-4 py-2 text-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                    b.is_expired
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  }`}
                                >
                                  {b.is_expired ? 'Expirado' : 'Válido'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStockDetailProduct(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Armazém */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <WarehouseIcon className="w-5 h-5 text-emerald-600" />
                Registar Novo Armazém / Depósito
              </h3>
              <button onClick={() => setShowWarehouseModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código do Armazém *
                </label>
                <input
                  type="text"
                  placeholder="ex: ARM-02 ou DEP-LOJA"
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Designação do Armazém *
                </label>
                <input
                  type="text"
                  placeholder="ex: Depósito Loja Talatona"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Endereço / Localização
                </label>
                <input
                  type="text"
                  placeholder="ex: Rua do Centro Comercial, Loja 12"
                  value={warehouseForm.address_detail}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, address_detail: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={warehouseForm.is_default}
                    onChange={(e) => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Definir como Armazém Principal / Padrão da Filial
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!warehouseForm.code || !warehouseForm.name || createWarehouseMutation.isPending}
                onClick={() =>
                  createWarehouseMutation.mutate({
                    branch_id: activeBranch?.id || 'b0000000-0000-0000-0000-000000000001',
                    code: warehouseForm.code,
                    name: warehouseForm.name,
                    is_default: warehouseForm.is_default,
                    address_detail: warehouseForm.address_detail || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Armazém
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Entrada de Compra (Receive Purchase) */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Entrada de Stock por Compra (Recálculo CMP)
              </h3>
              <button onClick={() => setShowPurchaseModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Armazém de Destino *
                </label>
                <select
                  value={purchaseForm.warehouse_id}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o armazém...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Artigo a Receber *
                </label>
                <select
                  value={purchaseForm.product_id}
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === e.target.value);
                    setPurchaseForm({
                      ...purchaseForm,
                      product_id: e.target.value,
                      unit_cost: prod ? String(prod.cost_price || prod.current_cmp) : '0',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o produto físico...</option>
                  {products
                    .filter((p) => p.product_type === 'P')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={purchaseForm.quantity}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Custo Unitário de Compra (Kz) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={purchaseForm.unit_cost}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, unit_cost: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Documento de Compra / Fornecedor Ref
                </label>
                <input
                  type="text"
                  placeholder="ex: FT FORN/2026/0129 ou Guia de Remessa"
                  value={purchaseForm.document_ref}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, document_ref: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Notas / Observações
                </label>
                <input
                  type="text"
                  placeholder="Conferência física sem avarias"
                  value={purchaseForm.notes}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!purchaseForm.warehouse_id || !purchaseForm.product_id || purchaseMutation.isPending}
                onClick={() =>
                  purchaseMutation.mutate({
                    warehouse_id: purchaseForm.warehouse_id,
                    product_id: purchaseForm.product_id,
                    quantity: purchaseForm.quantity,
                    unit_cost: purchaseForm.unit_cost,
                    document_ref: purchaseForm.document_ref || undefined,
                    notes: purchaseForm.notes || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirmar Entrada
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Transferência entre Armazéns */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                Transferência entre Armazéns
              </h3>
              <button onClick={() => setShowTransferModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Armazém de Origem *
                </label>
                <select
                  value={transferForm.from_warehouse_id}
                  onChange={(e) => setTransferForm({ ...transferForm, from_warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o armazém de origem...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Armazém de Destino *
                </label>
                <select
                  value={transferForm.to_warehouse_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o armazém de destino...</option>
                  {warehouses
                    .filter((w) => w.id !== transferForm.from_warehouse_id)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Artigo a Transferir *
                </label>
                <select
                  value={transferForm.product_id}
                  onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o produto...</option>
                  {products
                    .filter((p) => p.product_type === 'P')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Quantidade a Transferir *
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Guia / Notas de Transferência
                </label>
                <input
                  type="text"
                  placeholder="ex: Guia de Transporte GT 2026/001"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !transferForm.from_warehouse_id ||
                  !transferForm.to_warehouse_id ||
                  !transferForm.product_id ||
                  transferMutation.isPending
                }
                onClick={() =>
                  transferMutation.mutate({
                    from_warehouse_id: transferForm.from_warehouse_id,
                    to_warehouse_id: transferForm.to_warehouse_id,
                    product_id: transferForm.product_id,
                    quantity: transferForm.quantity,
                    notes: transferForm.notes || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Efetuar Transferência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ajuste / Quebras */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Ajuste de Inventário ou Quebra
              </h3>
              <button onClick={() => setShowAdjustModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Armazém *
                </label>
                <select
                  value={adjustForm.warehouse_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o armazém...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Artigo *
                </label>
                <select
                  value={adjustForm.product_id}
                  onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o produto...</option>
                  {products
                    .filter((p) => p.product_type === 'P')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Variação de Quantidade (Delta: positivo para sobra, negativo para quebra) *
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="ex: -5 ou +10"
                  value={adjustForm.quantity_delta}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity_delta: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={adjustForm.is_waste}
                    onChange={(e) => setAdjustForm({ ...adjustForm, is_waste: e.target.checked })}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  Classificar como Desperdício / Quebra de Armazém
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Justificação / Documento de Ajuste
                </label>
                <input
                  type="text"
                  placeholder="ex: Auto de Quebra n.º 05/2026 ou Inventário Físico Anual"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !adjustForm.warehouse_id ||
                  !adjustForm.product_id ||
                  adjustForm.quantity_delta === '0' ||
                  adjustMutation.isPending
                }
                onClick={() =>
                  adjustMutation.mutate({
                    warehouse_id: adjustForm.warehouse_id,
                    product_id: adjustForm.product_id,
                    quantity_delta: adjustForm.quantity_delta,
                    is_waste: adjustForm.is_waste,
                    notes: adjustForm.notes || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Confirmar Ajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar Lote */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                Criar Novo Lote de Artigo
              </h3>
              <button onClick={() => setShowBatchModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Artigo *
                </label>
                <select
                  value={batchForm.product_id}
                  onChange={(e) => setBatchForm({ ...batchForm, product_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o artigo com lotes...</option>
                  {products
                    .filter((p) => p.track_lots)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Número do Lote *
                </label>
                <input
                  type="text"
                  placeholder="ex: LT-2026-002"
                  value={batchForm.batch_number}
                  onChange={(e) => setBatchForm({ ...batchForm, batch_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data de Fabrico
                  </label>
                  <input
                    type="date"
                    value={batchForm.manufacture_date}
                    onChange={(e) => setBatchForm({ ...batchForm, manufacture_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data de Validade
                  </label>
                  <input
                    type="date"
                    value={batchForm.expiry_date}
                    onChange={(e) => setBatchForm({ ...batchForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!batchForm.product_id || !batchForm.batch_number || createBatchMutation.isPending}
                onClick={() =>
                  createBatchMutation.mutate({
                    product_id: batchForm.product_id,
                    batch_number: batchForm.batch_number,
                    manufacture_date: batchForm.manufacture_date || undefined,
                    expiry_date: batchForm.expiry_date || undefined,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Lote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registar Entidade (Cliente / Fornecedor) */}
      {showEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Registar Cliente ou Fornecedor
              </h3>
              <button onClick={() => setShowEntityModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo de Entidade *
                </label>
                <select
                  value={entityForm.entity_type}
                  onChange={(e) =>
                    setEntityForm({
                      ...entityForm,
                      entity_type: e.target.value as 'CUSTOMER' | 'SUPPLIER' | 'BOTH',
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="CUSTOMER">Cliente</option>
                  <option value="SUPPLIER">Fornecedor</option>
                  <option value="BOTH">Ambos (Cliente &amp; Fornecedor)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo de NIF / Identificador *
                </label>
                <select
                  value={entityForm.tax_id_kind}
                  onChange={(e) =>
                    setEntityForm({
                      ...entityForm,
                      tax_id_kind: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="LEGAL_ENTITY">Empresa / Pessoa Coletiva (54...)</option>
                  <option value="NATURAL_PERSON_BI">Pessoa Singular (BI)</option>
                  <option value="FINAL_CONSUMER">Consumidor Final (999999999)</option>
                  <option value="FOREIGN">Entidade Estrangeira</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  NIF *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 5417089123"
                  value={entityForm.tax_id}
                  onChange={(e) => setEntityForm({ ...entityForm, tax_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: TotalEnergies Angola SA"
                  value={entityForm.name}
                  onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Telefone
                </label>
                <input
                  type="text"
                  placeholder="+244 923 000 000"
                  value={entityForm.phone || ''}
                  onChange={(e) => setEntityForm({ ...entityForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="financeiro@empresa.co.ao"
                  value={entityForm.email || ''}
                  onChange={(e) => setEntityForm({ ...entityForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Cidade / Província
                </label>
                <input
                  type="text"
                  placeholder="Luanda"
                  value={entityForm.city || ''}
                  onChange={(e) => setEntityForm({ ...entityForm, city: e.target.value, province: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  IBAN Angolano (AO06)
                </label>
                <input
                  type="text"
                  placeholder="AO06 0040 0000 1234 5678 9012 3"
                  value={entityForm.iban || ''}
                  onChange={(e) => setEntityForm({ ...entityForm, iban: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                />
              </div>

              <div className="md:col-span-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={entityForm.is_withholding_agent}
                    onChange={(e) =>
                      setEntityForm({ ...entityForm, is_withholding_agent: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Agente de Retenção de IVA Cativo (Grandes Contribuintes AGT)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEntityModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!entityForm.tax_id || !entityForm.name || registerEntityMutation.isPending}
                onClick={() => registerEntityMutation.mutate(entityForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Entidade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
