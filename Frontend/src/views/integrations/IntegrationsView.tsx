import React, { useState } from 'react';
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
} from '../../api/integrations';

type ActiveTab = 'endpoints' | 'mappings' | 'runs';

export const IntegrationsView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('endpoints');

  // Modais
  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEndpointForImport, setSelectedEndpointForImport] = useState<string>('');
  const [importContent, setImportContent] = useState<string>('');
  const [importContentType, setImportContentType] = useState<string>('application/json');

  // Formulário de Endpoint
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

  // Formulário de Mapeamento
  const [mappingEndpointId, setMappingEndpointId] = useState<string>('');
  const [mappingForm, setMappingForm] = useState<CreateMappingPayload>({
    name: 'Mapeamento Artigos / Stock',
    entity_type: 'PRODUCT',
    target_event_type: 'inventory.product.imported',
    target_routing_key: 'kudiba.inventory.catalog_sync',
    conflict_policy: 'OVERWRITE' as ConflictPolicy,
    root_path: 'data.items',
    fields: [
      { source_path: 'id_artigo', target_field: 'code', is_required: true },
      { source_path: 'descricao', target_field: 'name', is_required: true },
      { source_path: 'preco_venda', target_field: 'unit_price', is_required: true },
    ],
  });

  // Queries
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
    queryFn: () => integrationsApi.listRuns({ limit: 50 }),
    enabled: Boolean(activeTenant?.id),
    refetchInterval: 10000,
  });

  // Mutations
  const createEndpointMutation = useMutation({
    mutationFn: (payload: CreateEndpointPayload) => integrationsApi.createEndpoint(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_endpoints'] });
      setShowEndpointModal(false);
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
    mutationFn: ({ endpointId, content, contentType }: { endpointId: string; content: string; contentType: string }) =>
      integrationsApi.importFile(endpointId, content, contentType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration_runs'] });
      setShowImportModal(false);
      setImportContent('');
      setActiveTab('runs');
    },
  });

  // Totais agregados
  const activeEndpointsCount = endpoints.filter((e) => e.is_enabled).length;
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === 'SUCCESS').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
  const totalRecordsSucceeded = runs.reduce((acc, r) => acc + (r.records_succeeded || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            Hub de Integrações &amp; ETL
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conectores REST Pull, Webhooks e importação de dados para o ecossistema Kudiba
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (endpoints.length > 0) setSelectedEndpointForImport(endpoints[0].id);
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            Importar Ficheiro (ETL)
          </button>

          <button
            onClick={() => setShowEndpointModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
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
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Conectores Ativos</span>
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
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Mapeamentos Ativos</span>
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
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Registos Ingeridos</span>
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
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Taxa de Sucesso</span>
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'endpoints'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
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
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
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
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Histórico de Execuções ({runs.length})
        </button>
      </div>

      {/* Tab 1: Conectores & Endpoints */}
      {activeTab === 'endpoints' && (
        <div className="space-y-4">
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
                  ) : endpoints.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhum conector registado. Clique em "Novo Conector" para integrar um ERP, loja online ou ficheiro.
                      </td>
                    </tr>
                  ) : (
                    endpoints.map((ep) => (
                      <tr key={ep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          <span className="block">{ep.name}</span>
                          <span className="text-xs text-slate-400 font-mono block">
                            {ep.connector_type === 'REST_PULL' ? ep.source_url : ep.id.slice(0, 8)}
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
                          {ep.last_run_at ? new Date(ep.last_run_at).toLocaleString('pt-AO') : 'Nunca executado'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge
                            status={ep.is_enabled ? 'ok' : 'acompanhar'}
                            label={ep.is_enabled ? 'Ativo' : 'Pausado'}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => runEndpointMutation.mutate(ep.id)}
                              disabled={runEndpointMutation.isPending}
                              title="Disparar Execução Imediata"
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              <Play className="w-4 h-4" />
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
        </div>
      )}

      {/* Tab 2: Mapeamento de Campos */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          <div className="flex justify-end">
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
                            {m.fields?.length || 0} campos configurados
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

      {/* Tab 3: Histórico de Execuções */}
      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {runsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar histórico de execuções...
                      </td>
                    </tr>
                  ) : runs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma execução registada até ao momento.
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => {
                      const ep = endpoints.find((e) => e.id === r.endpoint_id);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {new Date(r.started_at).toLocaleString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {ep ? ep.name : r.endpoint_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {r.trigger_type}
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
                            {r.error_message || (r.status === 'SUCCESS' ? 'Concluído sem erros' : '—')}
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

      {/* Modal: Novo Conector / Endpoint */}
      {showEndpointModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
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
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {createEndpointMutation.isPending ? 'A registar...' : 'Criar Conector'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importar Ficheiro (ETL) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-emerald-600" />
                Importar Dados Externos (ETL)
              </h3>
              <button onClick={() => setShowImportModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

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
              className="space-y-3"
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Conteúdo do Ficheiro (Cole ou carregue) *
                </label>
                <textarea
                  rows={8}
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
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                >
                  {importFileMutation.isPending ? 'A processar ingestão...' : 'Processar Ingestão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Mapeamento */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Criar Esquema de Mapeamento
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
              className="space-y-3"
            >
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
                  placeholder="Ex: Mapeamento de Faturas Primavera para Kudiba"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  </select>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Target Event Type
                  </label>
                  <input
                    type="text"
                    required
                    value={mappingForm.target_event_type}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, target_event_type: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Routing Key
                  </label>
                  <input
                    type="text"
                    required
                    value={mappingForm.target_routing_key}
                    onChange={(e) =>
                      setMappingForm({ ...mappingForm, target_routing_key: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Campos Mapeados (Fonte &rarr; Kudiba)
                </span>
                <div className="space-y-2">
                  {mappingForm.fields.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                      <input
                        type="text"
                        placeholder="Campo Fonte"
                        value={f.source_path}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            fields: mappingForm.fields.map((item, i) =>
                              i === idx ? { ...item, source_path: e.target.value } : item
                            ),
                          })
                        }
                        className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                      />
                      <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="Campo Kudiba"
                        value={f.target_field}
                        onChange={(e) =>
                          setMappingForm({
                            ...mappingForm,
                            fields: mappingForm.fields.map((item, i) =>
                              i === idx ? { ...item, target_field: e.target.value } : item
                            ),
                          })
                        }
                        className="flex-1 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                      />
                    </div>
                  ))}
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
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                >
                  {createMappingMutation.isPending ? 'A guardar...' : 'Criar Mapeamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
