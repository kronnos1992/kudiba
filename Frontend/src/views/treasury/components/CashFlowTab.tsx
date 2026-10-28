import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  Landmark,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Layers,
  Banknote,
  DollarSign,
  Euro,
} from 'lucide-react';
import { GlassCard } from '../../../components/common/GlassCard';
import {
  getLocalDateString,
  ReportDateFilter,
  resolveReportDateRange,
} from '../../../components/common/ReportDateFilter';
import { KzAmount } from '../../../components/common/KzAmount';
import { treasuryApi, CashFlowReport } from '../../../api/treasury';

interface CashFlowTabProps {
  tenantId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({ tenantId, onNavigateTab }) => {
  const [viewMode, setViewMode] = useState<'overview' | 'activities' | 'projections'>('overview');
  const [reportStartDate, setReportStartDate] = useState(getLocalDateString);
  const [reportEndDate, setReportEndDate] = useState(getLocalDateString);
  const reportDateRange = resolveReportDateRange(reportStartDate, reportEndDate);

  const { data: report, isLoading } = useQuery<CashFlowReport>({
    queryKey: [
      'treasury_cash_flow',
      tenantId,
      reportDateRange.startDate,
      reportDateRange.endDate,
    ],
    queryFn: () =>
      treasuryApi.getCashFlow({
        start_date: reportDateRange.startDate,
        end_date: reportDateRange.endDate,
      }),
    enabled: Boolean(tenantId),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          A consolidar fluxo de caixa e disponibilidades...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <GlassCard className="p-8 text-center text-slate-500">
        Não foi possível carregar os dados de fluxo de caixa.
      </GlassCard>
    );
  }

  const { current_liquidity, realized, forecast, projections, alerts } = report;

  return (
    <div className="space-y-6">
      <ReportDateFilter
        startDate={reportStartDate}
        endDate={reportEndDate}
        onStartDateChange={setReportStartDate}
        onEndDateChange={setReportEndDate}
      />

      {/* Alertas Fiscais e de Tesouraria Angolana */}
      {alerts && alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {alerts.map((alert, idx) => {
            const isDanger = alert.severity === 'DANGER';
            const isWarning = alert.severity === 'WARNING';
            const bgClass = isDanger
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
              : isWarning
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300';
            const Icon = isDanger ? ShieldAlert : isWarning ? AlertTriangle : Info;

            return (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3.5 rounded-xl border text-xs sm:text-sm ${bgClass}`}
              >
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{alert.title}</span>
                    {alert.due_date && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/70 dark:bg-black/40">
                        {alert.due_date}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs opacity-90 leading-relaxed">{alert.message}</p>
                  {alert.title.includes('Fornecedores') && onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('payables')}
                      className="mt-1 text-[11px] font-bold underline block hover:opacity-80"
                    >
                      Abrir Contas a Pagar &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4 Cards Principais de Liquidez e Fluxo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Saldo Disponível Consolidado */}
        <GlassCard className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Disponibilidade Real
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            <KzAmount value={current_liquidity.total_available_aoa} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>Conciliado:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              <KzAmount value={current_liquidity.reconciled_balance_aoa} />
            </span>
          </div>
          {current_liquidity.pending_clearance_aoa > 0 && (
            <div className="mt-1 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400">
              <span>Pendente compensação:</span>
              <span><KzAmount value={current_liquidity.pending_clearance_aoa} /></span>
            </div>
          )}
        </GlassCard>

        {/* Card 2: Entradas Realizadas (Mês) */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Entradas Realizadas
            </span>
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-teal-600 dark:text-teal-400">
            +<KzAmount value={realized.total_inflows} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
            <span>Operações:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {realized.inflows_by_method.reduce((sum, m) => sum + m.count, 0)} movimentos
            </span>
          </div>
        </GlassCard>

        {/* Card 3: Saídas Realizadas (Mês) */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Saídas Realizadas
            </span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600 dark:text-rose-400">
            -<KzAmount value={realized.total_outflows} />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
            <span>Fluxo Líquido:</span>
            <span
              className={`font-bold ${
                realized.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {realized.net_cash_flow >= 0 ? '+' : ''}
              <KzAmount value={realized.net_cash_flow} />
            </span>
          </div>
        </GlassCard>

        {/* Card 4: Saldo Projetado a 30 Dias */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Projeção (30 dias)
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-indigo-600 dark:text-indigo-400">
            <KzAmount
              value={
                projections.length > 0
                  ? projections[projections.length - 1].ending_balance
                  : current_liquidity.total_available_aoa
              }
            />
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
            <span>Risco de Liquidez:</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Sustentável
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Seletor de Perspetiva do Fluxo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'overview'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Visão Geral &amp; Reservas
          </button>
          <button
            onClick={() => setViewMode('activities')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'activities'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Três Atividades (PGC Angolano)
          </button>
          <button
            onClick={() => setViewMode('projections')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'projections'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Previsão Diária (30 Dias)
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>Período: <strong>{report.period_start}</strong> até <strong>{report.period_end}</strong></span>
        </div>
      </div>

      {/* Conteúdo da Perspetiva Selecionada */}

      {/* 1. VISÃO GERAL & RESERVAS */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1 & 2: Meios de Pagamento Realizados e Categorias de Despesa */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Entradas Efetivas por Instrumento de Pagamento (Angola)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {realized.inflows_by_method.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {item.method === 'TRANSFERENCIA'
                          ? 'Transferência Bancária (STC)'
                          : item.method === 'MULTICAIXA'
                          ? 'Cartão / TPA (Rede EMIS)'
                          : item.method === 'MULTICAIXA_EXPRESS'
                          ? 'MULTICAIXA Express'
                          : item.method === 'GPO_REFERENCE'
                          ? 'Pagamento por Referência'
                          : item.method === 'NUMERARIO_POS'
                          ? 'Numerário em Caixa (PDV)'
                          : item.method}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {item.count} recebimento(s)
                      </p>
                    </div>
                    <div className="text-right font-bold text-sm text-teal-600 dark:text-teal-400">
                      +<KzAmount value={item.amount} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-rose-600" />
                <span>Saídas Efetivas por Categoria de Despesa</span>
              </h3>
              <div className="space-y-3">
                {realized.outflows_by_category.map((cat, idx) => {
                  const pct =
                    realized.total_outflows > 0
                      ? Math.round((Number(cat.amount) / Number(realized.total_outflows)) * 100)
                      : 0;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {cat.category === 'FORNECEDORES_MERCADORIAS'
                            ? 'Fornecedores de Mercadorias e Bens'
                            : cat.category === 'SERVICOS_TERCEIROS'
                            ? 'Prestadores de Serviços & Energia/Água'
                            : cat.category === 'EQUIPAMENTOS'
                            ? 'Investimentos em Equipamentos e TI'
                            : cat.category === 'DESPESAS_DE_CAIXA'
                            ? 'Despesas Correntes de Fundo de Maneio'
                            : cat.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-[11px]">{pct}%</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            -<KzAmount value={cat.amount} />
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>

          {/* Coluna 3: Reservas de Liquidez e Moeda Estrangeira */}
          <div className="space-y-6">
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Disponibilidades por Origem</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Caixas Físicos (Gavetas)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Fundo de maneio imediato</p>
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    <KzAmount value={current_liquidity.cash_in_hand_aoa} />
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Contas Bancárias Nacionais
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Saldo em Kwanzas (AOA)</p>
                  </div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    <KzAmount value={current_liquidity.bank_balances_aoa} />
                  </span>
                </div>
              </div>

              {/* Reservas em Moeda Estrangeira */}
              {current_liquidity.foreign_reserves && current_liquidity.foreign_reserves.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                    Reservas em Divisas (Câmbio BNA)
                  </h4>
                  <div className="space-y-2">
                    {current_liquidity.foreign_reserves.map((fr, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            {fr.currency === 'USD' ? (
                              <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                            ) : (
                              <Euro className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            {fr.bank_name}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {fr.balance_original.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}{' '}
                            {fr.currency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                          <span>1 {fr.currency} = {fr.exchange_rate_to_aoa} Kz</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            ≈ <KzAmount value={fr.converted_aoa} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Compromissos Fiscais Iminentes AGT */}
            <GlassCard className="p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Calendário Fiscal AGT (Este Mês)</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {forecast.tax_obligations.length === 0 ? (
                  <p className="py-4 text-center text-slate-500 dark:text-slate-400">
                    Sem obrigações fiscais registadas.
                  </p>
                ) : forecast.tax_obligations.map((tax, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-950/10"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{tax.tax_type.replace(/_/g, ' ')}</span>
                      <span className="text-rose-600 dark:text-rose-400">
                        <KzAmount value={tax.estimated_amount} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                      <span className="truncate pr-2">{tax.description}</span>
                      <span className="font-bold text-amber-700 dark:text-amber-300 shrink-0">
                        {tax.due_date}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* 2. TRÊS ATIVIDADES (PGC ANGOLANO) */}
      {viewMode === 'activities' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Atividades Operacionais */}
            <GlassCard className="p-5 border-t-4 border-t-emerald-500">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  1. Atividades Operacionais
                </h4>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Core Business
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Vendas correntes, recebimentos de clientes, pagamentos a fornecedores de mercadorias, despesas de operação e comissões TPA.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Entradas Operacionais:</span>
                  <span className="font-semibold text-emerald-600">
                    +<KzAmount value={realized.operational.inflows} />
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Saídas Operacionais:</span>
                  <span className="font-semibold text-rose-600">
                    -<KzAmount value={realized.operational.outflows} />
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
                  <span>Fluxo Operacional Líquido:</span>
                  <span className={realized.operational.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {realized.operational.net >= 0 ? '+' : ''}
                    <KzAmount value={realized.operational.net} />
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Atividades de Investimento */}
            <GlassCard className="p-5 border-t-4 border-t-blue-500">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  2. Atividades de Investimento
                </h4>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold">
                  Ativo Fixo
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Aquisição de equipamentos informáticos, servidores, infraestrutura de armazém e frotas de distribuição.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Alienação de Ativos:</span>
                  <span className="font-semibold text-emerald-600">
                    +<KzAmount value={realized.investment.inflows} />
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Aquisição de Equipamentos:</span>
                  <span className="font-semibold text-rose-600">
                    -<KzAmount value={realized.investment.outflows} />
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
                  <span>Fluxo de Investimento Líquido:</span>
                  <span className={realized.investment.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {realized.investment.net >= 0 ? '+' : ''}
                    <KzAmount value={realized.investment.net} />
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Atividades de Financiamento */}
            <GlassCard className="p-5 border-t-4 border-t-purple-500">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  3. Atividades de Financiamento
                </h4>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold">
                  Capital &amp; Dívida
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Empréstimos bancários contraídos, aumentos de capital de sócios, amortização de dívida e pagamentos de juros.
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Financiamentos Obtidos:</span>
                  <span className="font-semibold text-emerald-600">
                    +<KzAmount value={realized.financing.inflows} />
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Amortizações &amp; Juros:</span>
                  <span className="font-semibold text-rose-600">
                    -<KzAmount value={realized.financing.outflows} />
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm">
                  <span>Fluxo de Financiamento Líquido:</span>
                  <span className={realized.financing.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {realized.financing.net >= 0 ? '+' : ''}
                    <KzAmount value={realized.financing.net} />
                  </span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* DFC Consolidada (Demonstração de Fluxos de Caixa) */}
          <GlassCard className="p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Demonstração Consolidada dos Fluxos de Caixa (DFC)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-left">
                    <th className="py-2.5 font-bold">Rúbrica Financeira (PGC Angolano)</th>
                    <th className="py-2.5 text-right font-bold">Entradas</th>
                    <th className="py-2.5 text-right font-bold">Saídas</th>
                    <th className="py-2.5 text-right font-bold">Saldo Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      Fluxos de Caixa das Atividades Operacionais
                    </td>
                    <td className="py-2.5 text-right text-emerald-600 font-semibold">
                      <KzAmount value={realized.operational.inflows} />
                    </td>
                    <td className="py-2.5 text-right text-rose-600 font-semibold">
                      <KzAmount value={realized.operational.outflows} />
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      <KzAmount value={realized.operational.net} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      Fluxos de Caixa das Atividades de Investimento
                    </td>
                    <td className="py-2.5 text-right text-emerald-600 font-semibold">
                      <KzAmount value={realized.investment.inflows} />
                    </td>
                    <td className="py-2.5 text-right text-rose-600 font-semibold">
                      <KzAmount value={realized.investment.outflows} />
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      <KzAmount value={realized.investment.net} />
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200">
                      Fluxos de Caixa das Atividades de Financiamento
                    </td>
                    <td className="py-2.5 text-right text-emerald-600 font-semibold">
                      <KzAmount value={realized.financing.inflows} />
                    </td>
                    <td className="py-2.5 text-right text-rose-600 font-semibold">
                      <KzAmount value={realized.financing.outflows} />
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">
                      <KzAmount value={realized.financing.net} />
                    </td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold text-sm">
                    <td className="py-3 text-slate-900 dark:text-white">
                      Variação Líquida Global das Disponibilidades
                    </td>
                    <td className="py-3 text-right text-emerald-600">
                      <KzAmount value={realized.total_inflows} />
                    </td>
                    <td className="py-3 text-right text-rose-600">
                      <KzAmount value={realized.total_outflows} />
                    </td>
                    <td className={`py-3 text-right ${realized.net_cash_flow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {realized.net_cash_flow >= 0 ? '+' : ''}
                      <KzAmount value={realized.net_cash_flow} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* 3. PREVISÃO DIÁRIA (30 DIAS) */}
      {viewMode === 'projections' && (
        <GlassCard className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>Curva Diária de Previsão de Tesouraria (30 Dias)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Projeção cumulativa com datas de liquidação AGT (IVA dia 30, IRT dia 31, INSS dia 10) e vencimento de fornecedores.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                Saldo Sustentável
              </span>
              <span className="flex items-center gap-1.5 text-rose-600">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                Risco de Défice
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm">
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 text-left">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Saldo Inicial</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-emerald-600">Entradas Previstas</th>
                  <th className="py-2.5 px-3 text-right font-semibold text-rose-600">Saídas Programadas</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Saldo Projetado</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projections.map((p, idx) => (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                      p.is_deficit_risk ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {p.date}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                      <KzAmount value={p.starting_balance} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                      +{Number(p.expected_inflows).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-rose-600">
                      -{Number(p.expected_outflows).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                      <KzAmount value={p.ending_balance} />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.is_deficit_risk ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          Alerta Défice
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          Estável
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
