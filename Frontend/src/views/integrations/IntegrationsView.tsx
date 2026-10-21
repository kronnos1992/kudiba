import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Network,
  PlusCircle,
  Play,
  UploadCloud,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Database,
  X,
  Copy,
  Check,
  Sparkles,
  Code,
  FileText,
  AlertCircle,
  Eye,
  HelpCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  integrationsApi,
  CreateEndpointPayload,
  CreateMappingPayload,
  ConnectorType,
  DataFormat,
  AuthType,
  ConflictPolicy,
  INTEGRATION_TEMPLATES,
  IntegrationTemplate,
  RunResponse,
  EndpointResponse,
  MappingField,
} from '../../api/integrations';

type ActiveTab = 'endpoints' | 'mappings' | 'runs' | 'templates' | 'docs';

export const IntegrationsView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('endpoints');

  const [endpointTypeFilter, setEndpointTypeFilter] = useState<string>('ALL');
  const [endpointSearch, setEndpointSearch] = useState<string>('');

  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showWebhookGuideModal, setShowWebhookGuideModal] = useState(false);
  const [selectedWebhookEndpoint, setSelectedWebhookEndpoint] = useState<EndpointResponse | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<RunResponse | null>(null);

  const [selectedEndpointForImport, setSelectedEndpointForImport] = useState<string>('');
  const [importContent, setImportContent] = useState<string>('');
  const [importContentType, setImportContentType] = useState<string>('application/json');
  const [importFileName, setImportFileName] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  const [playgroundSample, setPlaygroundSample] = useState<string>('');
  const [playgroundOutput, setPlaygroundOutput] = useState<string>('');

  const [endpointForm, setEndpointForm] = useState<CreateEndpointPayload>({
    name: '',
    system_type: 'PRIMAVERA',
    connector_type: 'REST_PULL' as ConnectorType,
    description: '',
    auth_type: 'BEARER' as AuthType,
    source_url: 'https://api.erp.externo.ao/v1/sync',
    http_method: 'GET',
    data_format: 'JSON' as DataFormat,
    file_delimiter: ';',
    file_has_header: true,
    file_encoding: 'utf-8',
    is_enabled: true,
  });

  const [mappingEndpointId, setMappingEndpointId] = useState<string>('');
  const [mappingForm, setMappingForm] = useState<CreateMappingPayload>({
    name: 'Mapeamento de Artigos / Stock',
    entity_type: 'PRODUCT',
    target_event_type: 'inventory.product.imported',
    target_routing_key: 'kudiba.inventory.catalog_sync',
    conflict_policy: 'OVERWRITE' as ConflictPolicy,
    record_path: 'data.items',
    field_mappings: [
      { source: 'id_artigo', target: 'code', type: 'string', transform: 'trim', required: true },
      { source: 'descricao', target: 'name', type: 'string', transform: 'trim', required: true },
      { source: 'preco_venda', target: 'unit_price', type: 'decimal', required: true },
      { source: 'taxa_iva', target: 'tax_rate', type: 'decimal', default: 14 },
    ],
  });

  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery({
    queryKey: ['integration_endpoints', activeTenant?.id],
    queryFn: () => integrationsApi.listEndpoints(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['integration_mappings', activeTenant?.id],
    queryFn: () => integrationsApi.listMappings(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: runs = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['integration_runs', activeTenant?.id],
    queryFn: () => integrationsApi.listRuns({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
    refetchInterval: 10000,
  });

  const createEndpointMutation = useMutation({
    mutationFn: (payload: CreateEndpointPayload) => integrationsApi.createEndpoint(payload),
    onSuccess: (newEp) => {
      queryClient.invalidateQueries({ queryKey: ['integration_endpoints'] });
      setShowEndpointModal(false);
      setSelectedEndpointForImport(newEp.id);
      setEndpointForm({
        name: '',
        system_type: 'PRIMAVERA',
        connector_type: 'REST_PULL',
        description: '',
        auth_type: 'BEARER',
        source_url: '',
        http_method: 'GET',
        data_format: 'JSON',
        file_delimiter: ';',
        file_has_header: true,
        file_encoding: 'utf-8',
        is_enabled: true,
      });
    },
  });

  const deleteEndpointMutation = useMutation({
    mutationFn: (id: string) => integrationsApi.deleteEndpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_endpoints'] });
    },
  });

  const runEndpointMutation = useMutation({
    mutationFn: (id: string) => integrationsApi.runEndpointNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_runs'] });
      setActiveTab('runs');
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: ({ endpointId, payload }: { endpointId: string; payload: CreateMappingPayload }) =>
      integrationsApi.createMapping(endpointId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_mappings'] });
      setShowMappingModal(false);
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: string) => integrationsApi.deleteMapping(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_mappings'] });
    },
  });

  const importFileMutation = useMutation({
    mutationFn: ({
      endpointId,
      content,
      contentType,
    }: {
      endpointId: string;
      content: string;
      contentType: string;
    }) => integrationsApi.importFile(endpointId, content, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_runs'] });
      setShowImportModal(false);
      setImportContent('');
      setImportFileName('');
      setActiveTab('runs');
    },
  });

  const installTemplateMutation = useMutation({
    mutationFn: (tmpl: IntegrationTemplate) => integrationsApi.installTemplate(tmpl),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integration_endpoints'] });
      queryClient.invalidateQueries({ queryKey: ['integration_mappings'] });
      setSelectedEndpointForImport(data.endpoint.id);
      setActiveTab('endpoints');
    },
  });

  const activeEndpointsCount = endpoints.filter((e) => e.is_enabled).length;
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === 'SUCCESS').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
  const totalRecordsSucceeded = runs.reduce((acc, r) => acc + (r.records_succeeded || 0), 0);

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((ep) => {
      if (endpointTypeFilter !== 'ALL' && ep.connector_type !== endpointTypeFilter) {
        return false;
      }
      if (endpointSearch) {
        const q = endpointSearch.toLowerCase();
        return (
          ep.name.toLowerCase().includes(q) ||
          ep.system_type.toLowerCase().includes(q) ||
          (ep.source_url && ep.source_url.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [endpoints, endpointTypeFilter, endpointSearch]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    if (file.name.endsWith('.csv')) {
      setImportContentType('text/csv');
    } else if (file.name.endsWith('.json')) {
      setImportContentType('application/json');
    } else if (file.name.endsWith('.xml')) {
      setImportContentType('text/xml');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setImportContent(text || '');
    };
    reader.readAsText(file, 'utf-8');
  };

  const loadFieldPreset = (type: 'PRODUCT' | 'CUSTOMER' | 'INVOICE' | 'PAYMENT' | 'ATTENDANCE') => {
    if (type === 'PRODUCT') {
      setMappingForm({
        ...mappingForm,
        name: 'Mapeamento de Artigos / Stock',
        entity_type: 'PRODUCT',
        target_event_type: 'inventory.product.imported',
        target_routing_key: 'kudiba.inventory.catalog_sync',
        field_mappings: [
          { source: 'codigo', target: 'code', type: 'string', transform: 'trim', required: true },
          { source: 'descricao', target: 'name', type: 'string', transform: 'trim', required: true },
          { source: 'preco', target: 'unit_price', type: 'decimal', required: true },
          { source: 'taxa_iva', target: 'tax_rate', type: 'decimal', default: 14 },
          { source: 'codigo_barras', target: 'barcode', type: 'string' },
          { source: 'stock', target: 'stock_quantity', type: 'decimal', default: 0 },
        ],
      });
    } else if (type === 'CUSTOMER') {
      setMappingForm({
        ...mappingForm,
        name: 'Mapeamento de Clientes & NIFs',
        entity_type: 'CUSTOMER',
        target_event_type: 'customer.created',
        target_routing_key: 'kudiba.core.customer_sync',
        field_mappings: [
          { source: 'nif', target: 'tax_id', type: 'string', transform: 'trim', required: true },
          { source: 'nome', target: 'name', type: 'string', transform: 'trim', required: true },
          { source: 'telefone', target: 'phone', type: 'string' },
          { source: 'email', target: 'email', type: 'string', transform: 'lower' },
          { source: 'morada', target: 'address', type: 'string' },
        ],
      });
    } else if (type === 'INVOICE') {
      setMappingForm({
        ...mappingForm,
        name: 'Mapeamento de Vendas / Faturas Externas',
        entity_type: 'INVOICE',
        target_event_type: 'invoice.issued',
        target_routing_key: 'kudiba.invoicing.order_imported',
        field_mappings: [
          { source: 'numero_documento', target: 'invoice_number', type: 'string', required: true },
          { source: 'data', target: 'transaction_date', type: 'date', required: true },
          { source: 'cliente_nif', target: 'customer_tax_id', type: 'string', default: '999999999' },
          { source: 'total_liquido', target: 'total_amount', type: 'decimal', required: true },
          { source: 'total_imposto', target: 'tax_amount', type: 'decimal', default: 0 },
        ],
      });
    } else if (type === 'ATTENDANCE') {
      setMappingForm({
        ...mappingForm,
        name: 'Mapeamento de Picagens / Relógio de Ponto',
        entity_type: 'ATTENDANCE',
        target_event_type: 'attendance.recorded',
        target_routing_key: 'payroll.event.attendance.recorded',
        field_mappings: [
          { source: 'codigo_funcionario', target: 'employee_code', type: 'string', transform: 'trim', required: true },
          { source: 'data_hora', target: 'punched_at', type: 'datetime', required: true },
          { source: 'sentido', target: 'direction', type: 'string', default: 'IN' },
          { source: 'id_relogio', target: 'device_id', type: 'string', default: 'RELOGIO-01' },
          { source: 'id_registo', target: 'external_id', type: 'string' },
        ],
      });
    }
  };

  const handleSimulateMapping = () => {
    if (!playgroundSample.trim()) {
      setPlaygroundOutput('Introduza um JSON ou CSV no painel de amostra para simular.');
      return;
    }
    try {
      const data = JSON.parse(playgroundSample);
      const list = Array.isArray(data) ? data : [data];
      const result = list.map((item) => {
        const row: Record<string, any> = {};
        const fields = mappingForm.field_mappings || [];
        for (const f of fields) {
          const srcKey = f.source || f.source_path || '';
          const tgtKey = f.target || f.target_field || '';
          if (!tgtKey) continue;
          let val = item[srcKey];
          if (val === undefined || val === null || val === '') {
            val = f.default ?? f.default_value ?? (f.required ? '[OBRIGATÓRIO FALTANTE]' : null);
          } else {
            if (f.transform === 'upper') val = String(val).toUpperCase();
            if (f.transform === 'lower') val = String(val).toLowerCase();
            if (f.transform === 'trim') val = String(val).trim();
          }
          row[tgtKey] = val;
        }
        return row;
      });
      setPlaygroundOutput(JSON.stringify(result, null, 2));
    } catch {
      setPlaygroundOutput('Erro ao analisar JSON de amostra. Certifique-se de introduzir JSON válido.');
    }
  };

  const getWebhookUrl = (webhookKey?: string | null) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.kudiba.ao';
    return `${origin}/api/v1/integrations/webhooks/${webhookKey || 'CHAVE_DO_WEBHOOK'}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Network className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
              Hub de Integrações &amp; ETL
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Conectores &amp; Event Bus
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conectores REST Pull, Webhooks e importação de dados para o ecossistema Kudiba
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('templates')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-sm font-semibold rounded-xl border border-indigo-200 dark:border-indigo-800 transition"
          >
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Templates Prontos
          </button>

          <button
            onClick={() => {
              if (endpoints.length > 0 && !selectedEndpointForImport) {
                setSelectedEndpointForImport(endpoints[0].id);
              }
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Importar Ficheiro (ETL)
          </button>

          <button
            onClick={() => setShowEndpointModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Conector
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">
              Conectores Ativos
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
              <Network className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {activeEndpointsCount} / {endpoints.length}
          </div>
          <span className="text-xs text-slate-400">REST, Webhooks &amp; Ficheiros</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">
              Mapeamentos Ativos
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg shrink-0">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {mappings.length}
          </div>
          <span className="text-xs text-slate-400">Esquemas de transformação</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">
              Registos Ingeridos
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg shrink-0">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {totalRecordsSucceeded.toLocaleString('pt-AO')}
          </div>
          <span className="text-xs text-purple-600 font-medium">Sincronizados com Sucesso</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">
              Taxa de Sucesso
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {successRate}%
          </div>
          <span className="text-xs text-slate-400">{totalRuns} execuções efetuadas</span>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'endpoints'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Network className="w-4 h-4" />
          Conectores &amp; Endpoints ({endpoints.length})
        </button>

        <button
          onClick={() => setActiveTab('mappings')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'mappings'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Layers className="w-4 h-4" />
          Mapeamento de Campos ({mappings.length})
        </button>

        <button
          onClick={() => setActiveTab('runs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'runs'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Histórico de Execuções ({runs.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'templates'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Catálogo de Presets &amp; Templates
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'docs'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          Guia &amp; Webhooks
        </button>
      </div>

      {/* TAB 1: CONECTORES & ENDPOINTS */}
      {activeTab === 'endpoints' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <input
                type="text"
                placeholder="Pesquisar conector por nome ou URL..."
                value={endpointSearch}
                onChange={(e) => setEndpointSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-72"
              />

              <select
                value={endpointTypeFilter}
                onChange={(e) => setEndpointTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="REST_PULL">REST Pull (Consulta Periódica)</option>
                <option value="WEBHOOK">Webhook (Receção em Tempo Real)</option>
                <option value="FILE_UPLOAD">File Upload (Carregamento Ficheiros)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Mostrando <span className="font-bold">{filteredEndpoints.length}</span> conectores
            </div>
          </GlassCard>

          {/* Se a lista estiver vazia, exibir estado com templates recomendados */}
          {endpoints.length === 0 && !endpointsLoading && (
            <GlassCard className="p-8 text-center space-y-4 border-dashed border-2 border-slate-300 dark:border-slate-700">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center font-bold">
                <Network className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nenhum conector registado ainda
                </h3>
                <p className="text-xs text-slate-500">
                  Integre o Kudiba ERP com o seu software externo em 1 clique utilizando um dos nossos templates oficiais pré-configurados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl mx-auto pt-2 text-left">
                {INTEGRATION_TEMPLATES.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:border-emerald-500 transition space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                        {tmpl.system_type}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {tmpl.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {tmpl.subtitle}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={installTemplateMutation.isPending}
                      onClick={() => installTemplateMutation.mutate(tmpl)}
                      className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                    >
                      {installTemplateMutation.isPending ? 'A instalar...' : 'Instalar Conector'}
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Tabela de Conectores */}
          {endpoints.length > 0 && (
            <GlassCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">Nome / Identificador</th>
                      <th className="px-4 py-3">Sistema Origem</th>
                      <th className="px-4 py-3">Tipo Conector</th>
                      <th className="px-4 py-3">Formato</th>
                      <th className="px-4 py-3">Última Execução</th>
                      <th className="px-4 py-3 text-center">Estado</th>
                      <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {endpointsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          A carregar conectores...
                        </td>
                      </tr>
                    ) : filteredEndpoints.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Nenhum conector encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredEndpoints.map((ep) => (
                        <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            <span className="block">{ep.name}</span>
                            <span className="text-xs text-slate-400 font-mono block">
                              {ep.connector_type === 'REST_PULL'
                                ? ep.source_url
                                : ep.connector_type === 'WEBHOOK'
                                ? `Webhook Key: ${ep.webhook_key?.slice(0, 12)}...`
                                : `Ficheiro Delimitado (${ep.file_delimiter || ';'})`}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                            {ep.system_type}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                ep.connector_type === 'REST_PULL'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : ep.connector_type === 'WEBHOOK'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {ep.connector_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                            {ep.data_format}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {ep.last_run_at
                              ? new Date(ep.last_run_at).toLocaleString('pt-AO')
                              : 'Nunca executado'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge
                              status={ep.is_enabled ? 'ok' : 'acompanhar'}
                              label={ep.is_enabled ? 'Ativo' : 'Pausado'}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {ep.connector_type === 'WEBHOOK' ? (
                                <button
                                  onClick={() => {
                                    setSelectedWebhookEndpoint(ep);
                                    setShowWebhookGuideModal(true);
                                  }}
                                  title="Ver URL e Instruções do Webhook"
                                  className="p-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                                >
                                  <Code className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => runEndpointMutation.mutate(ep.id)}
                                  disabled={runEndpointMutation.isPending}
                                  title="Disparar Execução Imediata"
                                  className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedEndpointForImport(ep.id);
                                  setShowImportModal(true);
                                }}
                                title="Importar Ficheiro para este Conector"
                                className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <UploadCloud className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  setMappingEndpointId(ep.id);
                                  setShowMappingModal(true);
                                }}
                                title="Configurar Novo Mapeamento"
                                className="p-1.5 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                              >
                                <Layers className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  if (confirm(`Deseja remover o conector "${ep.name}"?`)) {
                                    deleteEndpointMutation.mutate(ep.id);
                                  }
                                }}
                                title="Eliminar Conector"
                                className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* TAB 2: MAPEAMENTO DE CAMPOS */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Transformação dos esquemas de dados de ERPs externos nos eventos padrão do Kudiba
            </span>
            <button
              onClick={() => {
                if (endpoints.length > 0) setMappingEndpointId(endpoints[0].id);
                setShowMappingModal(true);
              }}
              disabled={endpoints.length === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Adicionar Mapeamento
            </button>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Mapeamento</th>
                    <th className="px-4 py-3">Endpoint Associado</th>
                    <th className="px-4 py-3">Entidade Kudiba</th>
                    <th className="px-4 py-3">Evento de Destino</th>
                    <th className="px-4 py-3">Campos Mapeados</th>
                    <th className="px-4 py-3 text-center">Conflito</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mappingsLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        A carregar esquemas de mapeamento...
                      </td>
                    </tr>
                  ) : mappings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhum mapeamento registado. Crie um mapeamento para transformar os dados da fonte nos modelos Kudiba.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => {
                      const ep = endpoints.find((e) => e.id === m.endpoint_id);
                      const fieldCount = m.field_mappings?.length || m.fields?.length || 0;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                            {ep ? ep.name : m.endpoint_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {m.entity_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            {m.target_event_type}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {fieldCount}
                            </span>{' '}
                            campos configurados
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {m.conflict_policy}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                if (confirm(`Eliminar o mapeamento "${m.name}"?`)) {
                                  deleteMappingMutation.mutate(m.id);
                                }
                              }}
                              title="Eliminar Mapeamento"
                              className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* TAB 3: HISTÓRICO DE EXECUÇÕES */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Registo auditável de todas as ingestões disparadas por Agendamento, Webhook ou Ficheiro
            </span>
            <button
              onClick={() => refetchRuns()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar Execuções
            </button>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Início</th>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3">Disparo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Recebidos</th>
                    <th className="px-4 py-3 text-right">Sucesso</th>
                    <th className="px-4 py-3 text-right">Falhas</th>
                    <th className="px-4 py-3">Detalhes / Mensagem</th>
                    <th className="px-4 py-3 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {runsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        A carregar histórico de execuções...
                      </td>
                    </tr>
                  ) : runs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma execução registada até ao momento.
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => {
                      const ep = endpoints.find((e) => e.id === r.endpoint_id);
                      return (
                        <tr
                          key={r.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer"
                          onClick={() => setSelectedRunDetails(r)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {new Date(r.started_at).toLocaleString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {ep ? ep.name : r.endpoint_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {r.trigger || r.trigger_type || 'MANUAL'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-extrabold ${
                                r.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : r.status === 'RUNNING'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 animate-pulse'
                                  : r.status === 'PARTIAL'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                            {r.records_received}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {r.records_succeeded}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {r.records_failed}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                            {r.message || r.error_message || (r.status === 'SUCCESS' ? 'Concluído sem erros' : '—')}
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedRunDetails(r)}
                              className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                              title="Ver Detalhes da Execução"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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

      {/* TAB 4: CATÁLOGO DE TEMPLATES RÁPIDOS */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="max-w-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Templates de Integração Pré-Configurados
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Instale em 1 clique o conector e o mapeamento de campos ideal para o seu sistema de origem. Todos os esquemas cumprem a arquitetura de eventos do Kudiba ERP.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INTEGRATION_TEMPLATES.map((tmpl) => (
              <GlassCard key={tmpl.id} className="p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 uppercase">
                      {tmpl.system_type} • {tmpl.connector_type}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      {tmpl.data_format}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {tmpl.title}
                  </h4>
                  <p className="text-xs text-slate-500">{tmpl.subtitle}</p>

                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1">
                    <div>
                      <span className="text-slate-400">Entidade Alvo:</span>{' '}
                      <span className="text-blue-600 font-bold">{tmpl.entity_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Routing Key:</span>{' '}
                      <span className="text-emerald-600 font-bold">{tmpl.mapping.target_routing_key}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Campos Mapeados:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-300">
                        {tmpl.mapping.field_mappings?.map((f) => f.target).join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPlaygroundSample(tmpl.sampleData);
                      setMappingForm(tmpl.mapping);
                      setActiveTab('mappings');
                      setShowMappingModal(true);
                    }}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    Ver / Personalizar
                  </button>

                  <button
                    type="button"
                    disabled={installTemplateMutation.isPending}
                    onClick={() => installTemplateMutation.mutate(tmpl)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                  >
                    {installTemplateMutation.isPending ? 'A instalar...' : 'Instalar Preset'}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: GUIA & WEBHOOKS */}
      {activeTab === 'docs' && (
        <div className="space-y-6 max-w-4xl">
          <GlassCard className="p-6 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-emerald-600" />
              Como Funciona o Hub de Integrações do Kudiba ERP
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              O microsserviço <span className="font-mono font-bold">KudibaIntegrations</span> atua como o ponto de entrada perimétrico para importar dados em lote (ETL) ou em fluxo contínuo (Webhooks e REST Pull). Os dados recebidos passam por um motor de validação e transformação (Mapeamento de Campos) e são despachados como eventos canónicos para o barramento RabbitMQ da empresa.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  1. Entrada (Ingest)
                </span>
                <p className="text-[11px] text-slate-500">
                  Via chamada periódica HTTP GET/POST (REST Pull), payload JSON disparado por loja externa (Webhook) ou upload manual de ficheiro CSV/XML.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  2. Mapeamento &amp; Deduplicação
                </span>
                <p className="text-[11px] text-slate-500">
                  O motor converte caminhos como <span className="font-mono">items[0].preco</span> para campos canónicos do Kudiba e calcula hash SHA-256 para evitar duplicados.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  3. Publicação no Barramento
                </span>
                <p className="text-[11px] text-slate-500">
                  Disparo de evento com envelope padrão no RabbitMQ para ser consumido assincronamente por KudibaInventory, Invoicing ou Treasury.
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Exemplo de Invocação de Webhook via cURL / Terminal
            </h4>
            <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto space-y-2">
              <div>curl -X POST \</div>
              <div className="pl-4 text-emerald-400">
                "{getWebhookUrl(endpoints.find((e) => e.connector_type === 'WEBHOOK')?.webhook_key)}" \
              </div>
              <div className="pl-4">-H "Content-Type: application/json" \</div>
              <div className="pl-4">-d '&#123;</div>
              <div className="pl-8">"order_number": "DOC-9912",</div>
              <div className="pl-8">"customer": &#123; "name": "Comercial Luanda", "tax_id": "540111222" &#125;,</div>
              <div className="pl-8">"total_price": 35000.00</div>
              <div className="pl-4">&#125;'</div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL: NOVO CONECTOR / ENDPOINT */}
      {showEndpointModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-emerald-600" />
                Registar Novo Conector de Integração
              </h3>
              <button onClick={() => setShowEndpointModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createEndpointMutation.mutate(endpointForm);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome do Conector *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Primavera ERP Vendas / Catálogo PHC"
                  value={endpointForm.name}
                  onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sistema Origem *
                  </label>
                  <select
                    value={endpointForm.system_type}
                    onChange={(e) => setEndpointForm({ ...endpointForm, system_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="PRIMAVERA">Primavera ERP</option>
                    <option value="PHC">PHC Software</option>
                    <option value="SAP">SAP ERP</option>
                    <option value="SHOPIFY">Shopify / E-Commerce</option>
                    <option value="EXCEL_CSV">Ficheiro CSV / Folha Excel</option>
                    <option value="CUSTOM">API Personalizada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tipo de Conector *
                  </label>
                  <select
                    value={endpointForm.connector_type}
                    onChange={(e) =>
                      setEndpointForm({
                        ...endpointForm,
                        connector_type: e.target.value as ConnectorType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    <option value="REST_PULL">REST Pull (Consulta Periódica)</option>
                    <option value="WEBHOOK">Webhook (Receção Instantânea)</option>
                    <option value="FILE_UPLOAD">File Upload (Carregamento Ficheiro)</option>
                  </select>
                </div>
              </div>

              {endpointForm.connector_type === 'REST_PULL' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    URL da API de Origem (HTTP GET/POST) *
                  </label>
                  <input
                    type="url"
                    required
                    value={endpointForm.source_url}
                    onChange={(e) => setEndpointForm({ ...endpointForm, source_url: e.target.value })}
                    placeholder="https://api.erp.empresa.ao/artigos"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Formato dos Dados *
                  </label>
                  <select
                    value={endpointForm.data_format}
                    onChange={(e) =>
                      setEndpointForm({
                        ...endpointForm,
                        data_format: e.target.value as DataFormat,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="JSON">JSON</option>
                    <option value="CSV">CSV / Delimitado</option>
                    <option value="XML">XML</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tipo de Autenticação
                  </label>
                  <select
                    value={endpointForm.auth_type}
                    onChange={(e) =>
                      setEndpointForm({
                        ...endpointForm,
                        auth_type: e.target.value as AuthType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="BEARER">Bearer Token</option>
                    <option value="API_KEY">API Key no Cabeçalho</option>
                    <option value="BASIC">Basic Auth (User/Pass)</option>
                    <option value="NONE">Sem Autenticação</option>
                  </select>
                </div>
              </div>

              {endpointForm.connector_type === 'FILE_UPLOAD' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Delimitador CSV
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={endpointForm.file_delimiter || ';'}
                      onChange={(e) =>
                        setEndpointForm({ ...endpointForm, file_delimiter: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Codificação
                    </label>
                    <input
                      type="text"
                      value={endpointForm.file_encoding || 'utf-8'}
                      onChange={(e) =>
                        setEndpointForm({ ...endpointForm, file_encoding: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Descrição / Notas
                </label>
                <input
                  type="text"
                  value={endpointForm.description || ''}
                  onChange={(e) => setEndpointForm({ ...endpointForm, description: e.target.value })}
                  placeholder="Sincronização de artigos de armazém central"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEndpointModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createEndpointMutation.isPending}
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50"
                >
                  {createEndpointMutation.isPending ? 'A registar...' : 'Criar Conector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR FICHEIRO (ETL) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600" />
                Importar Dados Externos (ETL)
              </h3>
              <button onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {endpoints.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Nenhum conector configurado
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Para importar um ficheiro é necessário um conector com o formato correspondente. Pode instalar o preset universal em 1 clique abaixo:
                </p>
                <button
                  type="button"
                  onClick={() => installTemplateMutation.mutate(INTEGRATION_TEMPLATES[1])}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                >
                  Criar Conector CSV Automático
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedEndpointForImport || !importContent.trim()) return;
                  importFileMutation.mutate({
                    endpointId: selectedEndpointForImport,
                    content: importContent,
                    contentType: importContentType,
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Selecione o Conector Destino *
                  </label>
                  <select
                    value={selectedEndpointForImport}
                    onChange={(e) => setSelectedEndpointForImport(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({ep.system_type} — {ep.data_format})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Carregar Ficheiro do Computador
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span>{importFileName || 'Escolher (.csv, .json, .xml)'}</span>
                      <input
                        type="file"
                        accept=".csv,.json,.xml,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Formato do Conteúdo (Content-Type)
                    </label>
                    <select
                      value={importContentType}
                      onChange={(e) => setImportContentType(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <option value="application/json">JSON (application/json)</option>
                      <option value="text/csv">CSV (text/csv)</option>
                      <option value="text/xml">XML (text/xml)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Conteúdo do Ficheiro (Cole ou carregue) *
                  </label>
                  <textarea
                    rows={7}
                    required
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder={`Exemplo CSV:\nCODIGO;NOME;PRECO\nART001;Arroz 25kg;18500\nART002;Óleo 5L;7200\n\nOu JSON:\n[\n  {"codigo": "ART001", "nome": "Arroz 25kg", "preco": 18500}\n]`}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={importFileMutation.isPending || !importContent.trim()}
                    className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-50"
                  >
                    {importFileMutation.isPending ? 'A processar ingestão...' : 'Processar Ingestão'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NOVO MAPEAMENTO DE CAMPOS & SANDBOX */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Configurar Esquema de Mapeamento
              </h3>
              <button onClick={() => setShowMappingModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!mappingEndpointId) return;
                createMappingMutation.mutate({
                  endpointId: mappingEndpointId,
                  payload: mappingForm,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Conector Associado *
                  </label>
                  <select
                    value={mappingEndpointId}
                    onChange={(e) => setMappingEndpointId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  >
                    {endpoints.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.name} ({ep.system_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Nome do Mapeamento *
                  </label>
                  <input
                    type="text"
                    required
                    value={mappingForm.name}
                    onChange={(e) => setMappingForm({ ...mappingForm, name: e.target.value })}
                    placeholder="Ex: Mapeamento de Faturas Primavera"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              {/* Presets Rápidos */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                  Carregar Modelo Pré-Configurado:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => loadFieldPreset('PRODUCT')}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    📦 Artigos / Produtos
                  </button>
                  <button
                    type="button"
                    onClick={() => loadFieldPreset('CUSTOMER')}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    👥 Clientes &amp; NIFs
                  </button>
                  <button
                    type="button"
                    onClick={() => loadFieldPreset('INVOICE')}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    🧾 Vendas / Faturas
                  </button>
                  <button
                    type="button"
                    onClick={() => loadFieldPreset('ATTENDANCE')}
                    className="px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-700/60 bg-teal-50/50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-xs font-semibold text-teal-700 dark:text-teal-300"
                  >
                    ⏰ Assiduidade / Relógio de Ponto
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Entidade Kudiba *
                  </label>
                  <select
                    value={mappingForm.entity_type}
                    onChange={(e) => setMappingForm({ ...mappingForm, entity_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="PRODUCT">Artigos / Produtos</option>
                    <option value="CUSTOMER">Clientes</option>
                    <option value="INVOICE">Faturas / Documentos</option>
                    <option value="PAYMENT">Pagamentos / Caixa</option>
                    <option value="ATTENDANCE">Assiduidade / Ponto Biométrico</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Caminho dos Registos (Record Path)
                  </label>
                  <input
                    type="text"
                    value={mappingForm.record_path || ''}
                    onChange={(e) => setMappingForm({ ...mappingForm, record_path: e.target.value })}
                    placeholder="data.items ou vazio"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Política de Conflito *
                  </label>
                  <select
                    value={mappingForm.conflict_policy}
                    onChange={(e) =>
                      setMappingForm({
                        ...mappingForm,
                        conflict_policy: e.target.value as ConflictPolicy,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="OVERWRITE">Sobrescrever Existente (OVERWRITE)</option>
                    <option value="SKIP">Ignorar se Já Existir (SKIP)</option>
                    <option value="FAIL">Abortar com Erro (FAIL)</option>
                  </select>
                </div>
              </div>

              {/* Tabela Dinâmica de Campos Mapeados */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Campos Mapeados ({mappingForm.field_mappings?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fields = mappingForm.field_mappings || [];
                      setMappingForm({
                        ...mappingForm,
                        field_mappings: [
                          ...fields,
                          { source: '', target: '', type: 'string', required: false },
                        ],
                      });
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar Campo
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800 font-sans font-bold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">Campo Origem (JSON/CSV)</th>
                        <th className="p-2.5 w-6"></th>
                        <th className="p-2.5">Campo Kudiba (Destino)</th>
                        <th className="p-2.5 w-28">Tipo</th>
                        <th className="p-2.5 w-24">Transform.</th>
                        <th className="p-2.5 text-center w-16">Obrig.</th>
                        <th className="p-2.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(mappingForm.field_mappings || []).map((f: MappingField, idx: number) => (
                        <tr key={idx}>
                          <td className="p-1.5">
                            <input
                              type="text"
                              required
                              placeholder="ex: id_artigo"
                              value={f.source || f.source_path || ''}
                              onChange={(e) => {
                                const newFields = [...(mappingForm.field_mappings || [])];
                                newFields[idx].source = e.target.value;
                                setMappingForm({ ...mappingForm, field_mappings: newFields });
                              }}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5 text-center text-slate-400">
                            <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              required
                              placeholder="ex: code"
                              value={f.target || f.target_field || ''}
                              onChange={(e) => {
                                const newFields = [...(mappingForm.field_mappings || [])];
                                newFields[idx].target = e.target.value;
                                setMappingForm({ ...mappingForm, field_mappings: newFields });
                              }}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold text-emerald-600 dark:text-emerald-400"
                            />
                          </td>
                          <td className="p-1.5">
                            <select
                              value={f.type || 'string'}
                              onChange={(e) => {
                                const newFields = [...(mappingForm.field_mappings || [])];
                                newFields[idx].type = e.target.value as any;
                                setMappingForm({ ...mappingForm, field_mappings: newFields });
                              }}
                              className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            >
                              <option value="string">string</option>
                              <option value="decimal">decimal</option>
                              <option value="int">int</option>
                              <option value="float">float</option>
                              <option value="bool">bool</option>
                              <option value="date">date</option>
                            </select>
                          </td>
                          <td className="p-1.5">
                            <select
                              value={f.transform || f.transform_rule || ''}
                              onChange={(e) => {
                                const newFields = [...(mappingForm.field_mappings || [])];
                                newFields[idx].transform = e.target.value as any;
                                setMappingForm({ ...mappingForm, field_mappings: newFields });
                              }}
                              className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            >
                              <option value="">Nenhuma</option>
                              <option value="trim">trim</option>
                              <option value="upper">upper</option>
                              <option value="lower">lower</option>
                            </select>
                          </td>
                          <td className="p-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={f.required ?? f.is_required ?? false}
                              onChange={(e) => {
                                const newFields = [...(mappingForm.field_mappings || [])];
                                newFields[idx].required = e.target.checked;
                                setMappingForm({ ...mappingForm, field_mappings: newFields });
                              }}
                              className="rounded border-slate-300 text-blue-600"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            {(mappingForm.field_mappings || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newFields = (mappingForm.field_mappings || []).filter(
                                    (_, i) => i !== idx
                                  );
                                  setMappingForm({ ...mappingForm, field_mappings: newFields });
                                }}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sandbox de Simulação */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Simular Transformação ao Vivo (Sandbox)
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateMapping}
                    className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-xs font-bold transition"
                  >
                    Testar Mapeamento
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Amostra JSON de Entrada:</span>
                    <textarea
                      rows={4}
                      value={playgroundSample}
                      onChange={(e) => setPlaygroundSample(e.target.value)}
                      placeholder='[{"id_artigo": "A1", "descricao": "Teste", "preco_venda": 100}]'
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block mb-1">Resultado Kudiba Transformado:</span>
                    <pre className="w-full p-2 h-24 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[11px] text-emerald-600 dark:text-emerald-400">
                      {playgroundOutput || 'Clique em "Testar Mapeamento" para simular.'}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMappingMutation.isPending}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md disabled:opacity-50"
                >
                  {createMappingMutation.isPending ? 'A guardar...' : 'Criar Mapeamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSTRUÇÕES DE WEBHOOK */}
      {showWebhookGuideModal && selectedWebhookEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-600" />
                Webhook: {selectedWebhookEndpoint.name}
              </h3>
              <button onClick={() => setShowWebhookGuideModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  URL de Receção do Webhook:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getWebhookUrl(selectedWebhookEndpoint.webhook_key)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getWebhookUrl(selectedWebhookEndpoint.webhook_key))}
                    className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition shrink-0"
                    title="Copiar URL"
                  >
                    {copiedUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300">
                <span className="font-bold block text-purple-900 dark:text-purple-200">
                  Instruções de Configuração Externa:
                </span>
                <p>
                  1. Cole este URL no painel do seu provedor (Shopify, Stripe, WooCommerce ou ERP).
                </p>
                <p>2. Método HTTP: <span className="font-mono font-bold">POST</span></p>
                <p>
                  3. Content-Type: <span className="font-mono font-bold">application/json</span>
                </p>
                {selectedWebhookEndpoint.webhook_header_name && (
                  <p>
                    4. Header de Assinatura:{' '}
                    <span className="font-mono font-bold">
                      {selectedWebhookEndpoint.webhook_header_name}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowWebhookGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DA EXECUÇÃO (AUDITORIA) */}
      {selectedRunDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Detalhes da Execução ETL
              </h3>
              <button onClick={() => setSelectedRunDetails(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block">ID da Execução:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedRunDetails.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Estado:</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      selectedRunDetails.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedRunDetails.status === 'FAILED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedRunDetails.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Recebidos</span>
                  <span className="text-base font-bold font-mono">
                    {selectedRunDetails.records_received}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-500 uppercase block">Sucesso</span>
                  <span className="text-base font-bold font-mono text-emerald-600">
                    {selectedRunDetails.records_succeeded}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-500 uppercase block">Falhas</span>
                  <span className="text-base font-bold font-mono text-rose-600">
                    {selectedRunDetails.records_failed}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Ignorados</span>
                  <span className="text-base font-bold font-mono">
                    {selectedRunDetails.records_skipped}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Mensagem do Processador / Erro:</span>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-[11px] text-slate-800 dark:text-slate-200">
                  {selectedRunDetails.message || selectedRunDetails.error_message || 'Nenhum erro registado. Concluído com sucesso.'}
                </div>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between">
                <span>Início: {new Date(selectedRunDetails.started_at).toLocaleString('pt-AO')}</span>
                {selectedRunDetails.finished_at && (
                  <span>
                    Fim: {new Date(selectedRunDetails.finished_at).toLocaleString('pt-AO')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRunDetails(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
