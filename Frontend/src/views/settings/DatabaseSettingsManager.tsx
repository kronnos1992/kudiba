import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Eye,
  EyeOff,
  Zap,
  Save,
  ShieldCheck,
  Layers,
  ArrowUpDown,
  Search,
} from 'lucide-react';
import { authApi, DatabaseNodeStatus, CustomDatabaseConnection } from '../../api/auth';
import { GlassCard } from '../../components/common/GlassCard';
import { toast } from '../../stores/toastStore';

interface SortConfig {
  key: keyof DatabaseNodeStatus;
  direction: 'asc' | 'desc';
}

export const DatabaseSettingsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'service_name', direction: 'asc' });
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<DatabaseNodeStatus | null>(null);

  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency_ms: number;
    version?: string | null;
    database?: string | null;
    user?: string | null;
    schema?: string | null;
    error?: string | null;
    tested_at: string;
  } | null>(null);

  // Form State
  const [formData, setFormData] = useState<CustomDatabaseConnection>({
    host: 'localhost',
    port: 5432,
    database: 'kudiba_erp',
    username: 'kudiba',
    password: '',
    schema_name: 'kudiba_core',
    ssl_mode: 'prefer',
    pool_size: 20,
    timeout_seconds: 5,
    read_replica_enabled: false,
    read_replica_host: '',
    read_replica_port: 5432,
    is_custom_configured: false,
  });

  const [formInitialized, setFormInitialized] = useState(false);

  // Fetch Database Overview
  const {
    data: overview,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['tenant_database_connections'],
    queryFn: async () => {
      const res = await authApi.getDatabaseConnections();
      if (!formInitialized && res.custom_connection) {
        setFormData({
          host: res.custom_connection.host || 'localhost',
          port: res.custom_connection.port || 5432,
          database: res.custom_connection.database || 'kudiba_erp',
          username: res.custom_connection.username || 'kudiba',
          password: res.custom_connection.has_password ? '••••••••' : '',
          schema_name: res.custom_connection.schema_name || 'kudiba_core',
          ssl_mode: res.custom_connection.ssl_mode || 'prefer',
          pool_size: res.custom_connection.pool_size || 20,
          timeout_seconds: res.custom_connection.timeout_seconds || 5,
          read_replica_enabled: Boolean(res.custom_connection.read_replica_enabled),
          read_replica_host: res.custom_connection.read_replica_host || '',
          read_replica_port: res.custom_connection.read_replica_port || 5432,
          is_custom_configured: Boolean(res.custom_connection.is_custom_configured),
          has_password: res.custom_connection.has_password,
          last_tested_at: res.custom_connection.last_tested_at,
          last_test_status: res.custom_connection.last_test_status,
          last_test_latency_ms: res.custom_connection.last_test_latency_ms,
        });
        setFormInitialized(true);
      }
      return res;
    },
    refetchOnWindowFocus: false,
  });

  // Test Connection Mutation
  const testMutation = useMutation({
    mutationFn: () =>
      authApi.testDatabaseConnection({
        host: formData.host,
        port: Number(formData.port),
        database: formData.database,
        username: formData.username,
        password: formData.password,
        ssl_mode: formData.ssl_mode,
        timeout_seconds: Number(formData.timeout_seconds),
      }),
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast.success(
          `Conexão estabelecida com sucesso! (${data.latency_ms.toFixed(1)} ms · ${data.version?.split(' ')[0] || 'PostgreSQL'})`
        );
      } else {
        toast.error(`Falha no teste de conexão: ${data.error || 'Erro desconhecido'}`);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Falha ao testar conexão';
      setTestResult({
        success: false,
        latency_ms: 0,
        error: msg,
        tested_at: new Date().toISOString(),
      });
      toast.error(msg);
    },
  });

  // Save Connection Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      authApi.updateDatabaseConnection({
        host: formData.host,
        port: Number(formData.port),
        database: formData.database,
        username: formData.username,
        password: formData.password,
        schema_name: formData.schema_name,
        ssl_mode: formData.ssl_mode,
        pool_size: Number(formData.pool_size),
        timeout_seconds: Number(formData.timeout_seconds),
        read_replica_enabled: formData.read_replica_enabled,
        read_replica_host: formData.read_replica_host,
        read_replica_port: formData.read_replica_port ? Number(formData.read_replica_port) : undefined,
        is_custom_configured: formData.is_custom_configured,
      }),
    onSuccess: (res) => {
      toast.success('Configurações de conexão à base de dados guardadas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tenant_database_connections'] });
      if (res.custom_connection?.has_password) {
        setFormData((prev) => ({ ...prev, password: '••••••••', has_password: true }));
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail || err?.message || 'Falha ao guardar configurações';
      toast.error(msg);
    },
  });

  // Handle Sort
  const handleSort = (key: keyof DatabaseNodeStatus) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Filtered & Sorted Nodes
  const filteredNodes = useMemo(() => {
    const list = overview?.cluster_nodes || [];
    const term = nodeSearch.toLowerCase().trim();

    const filtered = list.filter((node) => {
      if (!term) return true;
      return (
        node.service_name.toLowerCase().includes(term) ||
        node.database_name.toLowerCase().includes(term) ||
        node.role.toLowerCase().includes(term) ||
        node.status.toLowerCase().includes(term) ||
        node.host.toLowerCase().includes(term)
      );
    });

    return [...filtered].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      if (typeof aVal === 'string' || typeof bVal === 'string') {
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      if (numA < numB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (numA > numB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [overview?.cluster_nodes, nodeSearch, sortConfig]);

  // Overall Cluster Health
  const onlineCount = overview?.cluster_nodes?.filter((n) => n.status === 'ONLINE').length ?? 0;
  const totalCount = overview?.cluster_nodes?.length ?? 0;
  const avgLatency = useMemo(() => {
    const online = overview?.cluster_nodes?.filter((n) => n.status === 'ONLINE' && n.latency_ms !== null) || [];
    if (online.length === 0) return 0;
    const sum = online.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0);
    return Math.round((sum / online.length) * 10) / 10;
  }, [overview?.cluster_nodes]);

  return (
    <div className="space-y-6">
      {/* Resumo e Indicadores do Cluster de BD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nós do Cluster PostgreSQL
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {onlineCount} <span className="text-sm font-normal text-slate-400">/ {totalCount} Online</span>
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              onlineCount === totalCount ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Server className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Latência Média do Cluster
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {avgLatency > 0 ? `${avgLatency} ms` : '—'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Modo de Conexão Ativo
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
              {formData.is_custom_configured ? (
                <span className="text-indigo-600 dark:text-indigo-400">Dedicado (Custom)</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">Cluster Gerido</span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Motor &amp; Versão Padrão
            </span>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1 truncate max-w-[150px]">
              PostgreSQL 16
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
        </GlassCard>
      </div>

      {/* SECÇÃO 1: MONITORIZAÇÃO DOS BANCOS DO SISTEMA (ECOSSISTEMA KUDIBA) */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-brand-600" />
              Cluster de Bases de Dados Kudiba (Microsserviços)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Estado de conectividade, tempo de resposta e contagem de conexões ativas nos esquemas do sistema
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar base de dados..."
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              title="Actualizar estado dos nós"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Tabela de Nós com Cabeçalho Fixo e Drilldown */}
        <div className="overflow-x-auto max-h-[380px] border border-slate-200 dark:border-slate-800 rounded-xl relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th
                  onClick={() => handleSort('service_name')}
                  className="p-3 cursor-pointer select-none hover:text-blue-600 transition"
                >
                  <div className="flex items-center gap-1">
                    Microsserviço / Domínio
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('database_name')}
                  className="p-3 cursor-pointer select-none hover:text-blue-600 transition"
                >
                  <div className="flex items-center gap-1">
                    Base de Dados
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3">Host &amp; Porta</th>
                <th
                  onClick={() => handleSort('status')}
                  className="p-3 cursor-pointer select-none hover:text-blue-600 transition"
                >
                  <div className="flex items-center gap-1">
                    Estado
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('latency_ms')}
                  className="p-3 cursor-pointer select-none hover:text-blue-600 transition text-right"
                >
                  <div className="flex items-center justify-end gap-1">
                    Latência
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3 text-center">Conexões</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    A sondar nós e medir latências das bases de dados...
                  </td>
                </tr>
              ) : filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Nenhuma base de dados encontrada com o filtro especificado.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const isOnline = node.status === 'ONLINE';
                  return (
                    <React.Fragment key={node.service_id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <div>{node.service_name}</div>
                              <div className="text-[11px] font-normal text-slate-400">{node.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                          {node.database_name}
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {node.host}:{node.port}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isOnline
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                              }`}
                            />
                            {node.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {node.latency_ms !== null ? (
                            <span
                              className={
                                node.latency_ms < 20
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : node.latency_ms < 80
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400'
                              }
                            >
                              {node.latency_ms} ms
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">
                          {node.active_connections}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedNodeDetails((prev) =>
                                prev?.service_id === node.service_id ? null : node
                              )
                            }
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-[11px] font-medium transition"
                          >
                            {selectedNodeDetails?.service_id === node.service_id ? 'Fechar' : 'Detalhes'}
                          </button>
                        </td>
                      </tr>

                      {/* Drilldown Detalhes */}
                      {selectedNodeDetails?.service_id === node.service_id && (
                        <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                          <td colSpan={7} className="p-4 border-t border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div>
                                <span className="text-slate-400 font-semibold block">Driver / Conector:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">{node.driver}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-semibold block">Versão do PostgreSQL:</span>
                                <span className="font-mono text-slate-700 dark:text-slate-200">
                                  {node.version || 'PostgreSQL 16'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-semibold block">Status Detalhado:</span>
                                <span
                                  className={`font-semibold ${
                                    isOnline ? 'text-emerald-600' : 'text-red-600'
                                  }`}
                                >
                                  {isOnline ? 'Operacional e aceitando conexões' : node.error || 'Indisponível'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* SECÇÃO 2: PARAMETRIZAÇÃO DA BASE DE DADOS DA EMPRESA */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              Parametrização da Base de Dados da Empresa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure a base de dados principal, credenciais de acesso e nós de réplica dedicados para esta organização
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={formData.is_custom_configured}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, is_custom_configured: e.target.checked }))
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              Base de Dados Dedicada para esta Empresa
            </label>
          </div>
        </div>

        {/* Formulário de Configuração */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Host */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Host / Endereço IP do Servidor <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData((prev) => ({ ...prev, host: e.target.value }))}
              placeholder="ex: localhost ou db.minhaempresa.ao"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Porta */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Porta TCP <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData((prev) => ({ ...prev, port: Number(e.target.value) || 5432 }))}
              placeholder="5432"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Nome da Base de Dados */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Base de Dados <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.database}
              onChange={(e) => setFormData((prev) => ({ ...prev, database: e.target.value }))}
              placeholder="kudiba_erp"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Utilizador */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Utilizador / Role PostgreSQL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="kudiba"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Palavra-passe
              {formData.has_password && (
                <span className="text-[10px] text-emerald-600 ml-2 font-normal">(Gravada com segurança)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Insira para alterar..."
                className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Esquema Padrão */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Esquema Padrão (Schema)
            </label>
            <input
              type="text"
              value={formData.schema_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, schema_name: e.target.value }))}
              placeholder="kudiba_core"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Modo SSL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Modo SSL / Criptografia
            </label>
            <select
              value={formData.ssl_mode}
              onChange={(e) => setFormData((prev) => ({ ...prev, ssl_mode: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="disable">Desactivado (disable)</option>
              <option value="prefer">Preferencial (prefer - Padrão)</option>
              <option value="require">Obrigatório (require)</option>
              <option value="verify-ca">Verificar CA (verify-ca)</option>
              <option value="verify-full">Verificação Completa (verify-full)</option>
            </select>
          </div>

          {/* Pool Size */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Conexões Máximas no Pool (Max Pool Size)
            </label>
            <input
              type="number"
              min={1}
              max={200}
              value={formData.pool_size}
              onChange={(e) => setFormData((prev) => ({ ...prev, pool_size: Number(e.target.value) || 20 }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Timeout */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Timeout de Conexão (segundos)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={formData.timeout_seconds}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, timeout_seconds: Number(e.target.value) || 5 }))
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Read Replica Toggle & Config */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-indigo-500" />
                Réplica de Leitura Dedicada (Read-Only Replica)
              </span>
              <p className="text-[11px] text-slate-500">
                Encaminha relatórios analíticos, exportações SAF-T e balancetes para um nó secundário
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.read_replica_enabled}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, read_replica_enabled: e.target.checked }))
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {formData.read_replica_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Host da Réplica de Leitura
                </label>
                <input
                  type="text"
                  value={formData.read_replica_host}
                  onChange={(e) => setFormData((prev) => ({ ...prev, read_replica_host: e.target.value }))}
                  placeholder="ex: replica-read.minhaempresa.ao"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Porta TCP da Réplica
                </label>
                <input
                  type="number"
                  value={formData.read_replica_port || 5432}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      read_replica_port: Number(e.target.value) || 5432,
                    }))
                  }
                  placeholder="5432"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Feedback do Teste de Conexão */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <div className="font-bold">
                {testResult.success
                  ? 'Teste de Conectividade com a Base de Dados: BEM-SUCEDIDO'
                  : 'Falha no Teste de Conexão com o PostgreSQL'}
              </div>
              {testResult.success ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
                  <div>
                    <span className="opacity-75">Latência:</span>{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      {testResult.latency_ms.toFixed(1)} ms
                    </strong>
                  </div>
                  <div>
                    <span className="opacity-75">Motor:</span> {testResult.version?.split(' ')[0] || 'PostgreSQL 16'}
                  </div>
                  <div>
                    <span className="opacity-75">Base:</span> {testResult.database}
                  </div>
                  <div>
                    <span className="opacity-75">Utilizador:</span> {testResult.user}
                  </div>
                </div>
              ) : (
                <div className="font-mono text-[11px] bg-red-100/70 dark:bg-red-900/40 p-2 rounded border border-red-200 dark:border-red-800 break-all">
                  {testResult.error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            As credenciais são armazenadas de forma encriptada no PostgreSQL.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 text-amber-500 ${testMutation.isPending ? 'animate-bounce' : ''}`} />
              {testMutation.isPending ? 'A testar conexão...' : 'Testar Conexão'}
            </button>

            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'A guardar...' : 'Guardar Configurações'}
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
