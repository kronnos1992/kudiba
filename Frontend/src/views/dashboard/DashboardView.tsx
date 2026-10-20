import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Landmark,
  PlusCircle,
  Store,
  Users,
  Wallet,
  Boxes,
  Building2,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount, formatKwanza } from '../../components/common/KzAmount';
import { dashboardApi } from '../../api/dashboard';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CHART_COLORS = ['#059669', '#d97706', '#2563eb', '#7c3aed', '#dc2626', '#0891b2'];
const BILLABLE_MODULES = ['invoicing', 'treasury', 'payroll', 'inventory'];

const num = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const moneyFormatter: any = (value: any): string =>
  `${formatKwanza(num(Array.isArray(value) ? value[0] : value))} Kz`;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'rgba(15,23,42,0.95)',
  border: 'none',
  borderRadius: 12,
  color: '#f8fafc',
  fontSize: 12,
  padding: '8px 12px',
};

const axisTick = { fontSize: 11, fill: '#94a3b8' };

interface QueryLike<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
}

const KpiCard: React.FC<{
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ label, icon: Icon, iconClass, children, footer }) => (
  <GlassCard className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
        {label}
      </span>
      <Icon className={`w-5 h-5 shrink-0 ${iconClass}`} />
    </div>
    <div className="my-2.5 sm:my-3 min-w-0 break-words">{children}</div>
    {footer ? <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{footer}</div> : null}
  </GlassCard>
);

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <GlassCard className="p-4 sm:p-5 min-w-0 overflow-hidden">
    <div className="mb-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p> : null}
    </div>
    <div className="w-full min-w-0">{children}</div>
  </GlassCard>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-10 text-center text-xs text-slate-400">{message}</div>
);

const LoadingBlock: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-10 text-center text-slate-400">
    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
    <span className="text-xs">{message}</span>
  </div>
);

const DonutChart: React.FC<{ data: Array<{ name: string; value: number }>; money?: boolean }> = ({
  data,
  money,
}) => (
  <ResponsiveContainer width="100%" height={240}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
        {data.map((entry, index) => (
          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={tooltipStyle}
        {...(money ? { formatter: moneyFormatter } : {})}
      />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  </ResponsiveContainer>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, activeTenant } = useAuthStore();
  const isSuperadmin = Boolean(user?.is_superadmin);
  const subscribed = activeTenant?.subscribed_modules ?? null;
  const year = new Date().getFullYear();

  const can = (module: string): boolean =>
    isSuperadmin || !subscribed || subscribed.includes(module);

  const hasOperation = Boolean(activeTenant?.id);

  const invoicingQuery = useQuery({
    queryKey: ['dashboard_invoicing_summary', activeTenant?.id, year],
    queryFn: () => dashboardApi.getInvoicingSummary(year),
    enabled: can('invoicing') && hasOperation,
    retry: false,
  });

  const treasuryQuery = useQuery({
    queryKey: ['dashboard_treasury_summary', activeTenant?.id],
    queryFn: () => dashboardApi.getTreasurySummary(),
    enabled: can('treasury') && hasOperation,
    retry: false,
  });

  const payrollQuery = useQuery({
    queryKey: ['dashboard_payroll_summary', activeTenant?.id, year],
    queryFn: () => dashboardApi.getPayrollSummary(year),
    enabled: can('payroll') && hasOperation,
    retry: false,
  });

  const inventoryQuery = useQuery({
    queryKey: ['dashboard_inventory_summary', activeTenant?.id],
    queryFn: () => dashboardApi.getInventorySummary(),
    enabled: can('inventory') && hasOperation,
    retry: false,
  });

  const title = isSuperadmin ? 'Visão Plataforma' : 'Visão Empresa';
  const subtitle = isSuperadmin
    ? `Saúde financeira e operação · ${activeTenant?.name || 'Empresa activa'}`
    : `${activeTenant?.name || 'Kudiba Organização'} • NIF ${activeTenant?.taxId || '—'}`;

  const noModules = !isSuperadmin && BILLABLE_MODULES.every((m) => !can(m));

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
        </div>

        {isSuperadmin ? (
          <button
            onClick={() => onNavigate('clients')}
            className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Gerir Clientes</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => onNavigate('pos')}
              className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
            >
              <Store className="w-4 h-4 shrink-0" />
              <span>Terminal POS</span>
            </button>
            <button
              onClick={() => onNavigate('invoicing')}
              className="flex-1 sm:flex-initial justify-center inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Emitir Fatura</span>
            </button>
          </div>
        )}
      </div>

      {noModules ? (
        <GlassCard className="p-8 text-center text-slate-500 dark:text-slate-400">
          <Building2 className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold">Nenhum módulo subscrito.</p>
          <p className="text-xs mt-1">
            Contacte o administrador da plataforma para ativar os módulos da sua organização.
          </p>
        </GlassCard>
      ) : (
        <CompanyView
          invoicingQuery={invoicingQuery}
          treasuryQuery={treasuryQuery}
          payrollQuery={payrollQuery}
          inventoryQuery={inventoryQuery}
          can={can}
          year={year}
        />
      )}
    </div>
  );
};

const CompanyView: React.FC<{
  invoicingQuery: QueryLike<{
    totals: { invoicesCount: number; grossTotal: number | string; taxTotal: number | string; withholdingTotal: number | string };
    monthlyTrend: Array<{ month: number; grossTotal: number | string; taxTotal: number | string; invoicesCount: number }>;
    taxBreakdown: Array<{ taxRate: number | string; taxAmount: number | string }>;
  }>;
  treasuryQuery: QueryLike<{
    liquidity?: { total_balance_aoa: number | string; active_accounts: number };
    receivables?: { aging: Array<{ bucket: string; amount: number | string }> };
  }>;
  payrollQuery: QueryLike<{
    employees: { active: number; on_leave: number; suspended: number; terminated: number };
    organization: { departments: number };
  }>;
  inventoryQuery: QueryLike<{
    stock?: { value_by_cost: number | string; low_stock_count: number };
  }>;
  can: (module: string) => boolean;
  year: number;
}> = ({ invoicingQuery, treasuryQuery, payrollQuery, inventoryQuery, can, year }) => {
  const invoicing = invoicingQuery.data;
  const treasury = treasuryQuery.data;
  const payroll = payrollQuery.data;
  const inventory = inventoryQuery.data;

  const invoicingReady = can('invoicing') && !invoicingQuery.isError;
  const treasuryReady = can('treasury') && !treasuryQuery.isError;
  const payrollReady = can('payroll') && !payrollQuery.isError;
  const inventoryReady = can('inventory') && !inventoryQuery.isError;

  const anyLoading =
    (invoicingReady && invoicingQuery.isLoading) ||
    (treasuryReady && treasuryQuery.isLoading) ||
    (payrollReady && payrollQuery.isLoading) ||
    (inventoryReady && inventoryQuery.isLoading);

  const monthlyTrend = (invoicing?.monthlyTrend || []).map((p) => ({
    label: MONTHS[(p.month || 1) - 1],
    faturacao: num(p.grossTotal),
    iva: num(p.taxTotal),
    documentos: p.invoicesCount,
  }));

  const taxBreakdown = (invoicing?.taxBreakdown || []).map((t) => ({
    name: `${num(t.taxRate)}%`,
    value: num(t.taxAmount),
  }));

  const aging = (treasury?.receivables?.aging || []).map((a) => ({
    label: a.bucket,
    montante: num(a.amount),
  }));

  const employeesByStatus = payroll
    ? [
        { name: 'Ativos', value: payroll.employees.active },
        { name: 'Férias', value: payroll.employees.on_leave },
        { name: 'Suspensos', value: payroll.employees.suspended },
        { name: 'Cessados', value: payroll.employees.terminated },
      ].filter((d) => d.value > 0)
    : [];

  const invoiceCount = invoicing?.totals.invoicesCount ?? 0;

  return (
    <>
      {anyLoading && (
        <GlassCard className="p-6">
          <LoadingBlock message="A carregar indicadores..." />
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {invoicingReady && (
          <KpiCard
            label="Faturação Emitida"
            icon={TrendingUp}
            iconClass="text-emerald-600 dark:text-emerald-400"
            footer={`${invoiceCount} documento${invoiceCount !== 1 ? 's' : ''} em ${year}`}
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {invoicingQuery.isLoading ? '—' : <KzAmount value={num(invoicing?.totals.grossTotal)} />}
            </div>
          </KpiCard>
        )}

        {invoicingReady && (
          <KpiCard
            label="IVA Liquidado"
            icon={Landmark}
            iconClass="text-amber-600 dark:text-amber-400"
            footer={
              <span>
                Retenção: <KzAmount value={num(invoicing?.totals.withholdingTotal)} />
              </span>
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {invoicingQuery.isLoading ? '—' : <KzAmount value={num(invoicing?.totals.taxTotal)} />}
            </div>
          </KpiCard>
        )}

        {treasuryReady && (
          <KpiCard
            label="Liquidez Bancária"
            icon={Wallet}
            iconClass="text-blue-600 dark:text-blue-400"
            footer={`${treasury?.liquidity?.active_accounts ?? 0} conta${
              (treasury?.liquidity?.active_accounts ?? 0) !== 1 ? 's' : ''
            } ativa${(treasury?.liquidity?.active_accounts ?? 0) !== 1 ? 's' : ''}`}
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {treasuryQuery.isLoading ? '—' : <KzAmount value={num(treasury?.liquidity?.total_balance_aoa)} />}
            </div>
          </KpiCard>
        )}

        {payrollReady && (
          <KpiCard
            label="Colaboradores Ativos"
            icon={Users}
            iconClass="text-purple-600 dark:text-purple-400"
            footer={`${payroll?.employees.on_leave ?? 0} em férias · ${
              payroll?.organization.departments ?? 0
            } departamentos`}
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {payrollQuery.isLoading ? '—' : payroll?.employees.active ?? 0}
            </div>
          </KpiCard>
        )}

        {inventoryReady && (
          <KpiCard
            label="Valor de Stock"
            icon={Boxes}
            iconClass="text-emerald-600 dark:text-emerald-400"
            footer={`${inventory?.stock?.low_stock_count ?? 0} artigo${
              (inventory?.stock?.low_stock_count ?? 0) !== 1 ? 's' : ''
            } abaixo do ponto de encomenda`}
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {inventoryQuery.isLoading ? '—' : <KzAmount value={num(inventory?.stock?.value_by_cost)} />}
            </div>
          </KpiCard>
        )}
      </div>

      {invoicingReady && (
        <ChartCard title="Evolução Mensal da Faturação" subtitle={`Exercício fiscal ${year}`}>
          {invoicingQuery.isLoading ? (
            <LoadingBlock message="A carregar evolução..." />
          ) : monthlyTrend.length === 0 ? (
            <EmptyState message="Ainda não foram emitidos documentos fiscais neste exercício." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={moneyFormatter}
                />
                <Area
                  type="monotone"
                  dataKey="faturacao"
                  name="Faturação"
                  stroke="#059669"
                  strokeWidth={2}
                  fill="url(#grossGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {invoicingReady && taxBreakdown.length > 0 && (
          <ChartCard title="IVA por Taxa" subtitle="Repartição do imposto liquidado">
            <DonutChart data={taxBreakdown} money />
          </ChartCard>
        )}

        {treasuryReady && aging.length > 0 && (
          <ChartCard title="Antiguidade da Dívida" subtitle="Contas a receber por escalão">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={moneyFormatter}
                />
                <Bar dataKey="montante" name="Em dívida" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}

        {payrollReady && employeesByStatus.length > 0 && (
          <ChartCard title="Efetivos por Situação" subtitle="Distribuição do quadro de pessoal">
            <DonutChart data={employeesByStatus} />
          </ChartCard>
        )}
      </div>
    </>
  );
};

export default DashboardView;
