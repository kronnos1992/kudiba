import React, { useState } from 'react';
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
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  AlertCircle,
  Receipt,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount, formatKwanza } from '../../components/common/KzAmount';
import { dashboardApi } from '../../api/dashboard';
import {
  InvoicingDashboardSummary,
  TreasuryDashboardSummary,
  PayrollDashboardSummary,
  InventoryDashboardSummary,
} from '../../types/dashboard';
import { PlatformSummary, PlatformCommercialSummary } from '../../types/backoffice';

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

const ChartCard: React.FC<{
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, action, children }) => (
  <GlassCard className="p-4 sm:p-5 min-w-0 overflow-hidden">
    <div className="flex items-start justify-between gap-2 mb-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p> : null}
      </div>
      {action}
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

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [viewMode, setViewMode] = useState<'platform' | 'company'>(isSuperadmin ? 'platform' : 'company');

  const can = (module: string): boolean =>
    isSuperadmin || !subscribed || subscribed.includes(module);

  const hasOperation = Boolean(activeTenant?.id);

  const invoicingQuery = useQuery({
    queryKey: ['dashboard_invoicing_summary', activeTenant?.id, selectedYear],
    queryFn: () => dashboardApi.getInvoicingSummary(selectedYear),
    enabled: viewMode === 'company' && can('invoicing') && hasOperation,
    retry: false,
  });

  const treasuryQuery = useQuery({
    queryKey: ['dashboard_treasury_summary', activeTenant?.id],
    queryFn: () => dashboardApi.getTreasurySummary(),
    enabled: viewMode === 'company' && can('treasury') && hasOperation,
    retry: false,
  });

  const payrollQuery = useQuery({
    queryKey: ['dashboard_payroll_summary', activeTenant?.id, selectedYear],
    queryFn: () => dashboardApi.getPayrollSummary(selectedYear),
    enabled: viewMode === 'company' && can('payroll') && hasOperation,
    retry: false,
  });

  const inventoryQuery = useQuery({
    queryKey: ['dashboard_inventory_summary', activeTenant?.id],
    queryFn: () => dashboardApi.getInventorySummary(),
    enabled: viewMode === 'company' && can('inventory') && hasOperation,
    retry: false,
  });

  const platformQuery = useQuery({
    queryKey: ['dashboard_platform_summary'],
    queryFn: () => dashboardApi.getBackofficeSummary(),
    enabled: isSuperadmin && viewMode === 'platform',
    retry: false,
  });

  const commercialQuery = useQuery({
    queryKey: ['dashboard_commercial_summary'],
    queryFn: () => dashboardApi.getBackofficeCommercialSummary(),
    enabled: isSuperadmin && viewMode === 'platform',
    retry: false,
  });

  const title = isSuperadmin && viewMode === 'platform' ? 'Visão Plataforma SaaS' : 'Visão Executiva da Empresa';
  const subtitle =
    isSuperadmin && viewMode === 'platform'
      ? 'Métricas consolidadas de clientes, subscrições, licenças e expansão comercial'
      : `${activeTenant?.name || 'Kudiba Organização'} · NIF ${activeTenant?.taxId || '—'}`;

  const noModules = !isSuperadmin && BILLABLE_MODULES.every((m) => !can(m));

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              {title}
            </h2>
            {isSuperadmin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20">
                Superadmin
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isSuperadmin && (
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/80 dark:border-slate-700/80 text-xs font-semibold">
              <button
                onClick={() => setViewMode('platform')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'platform'
                    ? 'bg-emerald-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Plataforma SaaS</span>
              </button>
              <button
                onClick={() => setViewMode('company')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'company'
                    ? 'bg-emerald-700 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Empresa Activa</span>
              </button>
            </div>
          )}

          {viewMode === 'company' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Ano Fiscal:</span>
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
          )}

          {viewMode === 'platform' ? (
            <button
              onClick={() => onNavigate('clients')}
              className="justify-center inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Gerir Clientes B2B</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('pos')}
                className="justify-center inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
              >
                <Store className="w-4 h-4 shrink-0" />
                <span>POS</span>
              </button>
              <button
                onClick={() => onNavigate('invoicing')}
                className="justify-center inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Emitir Fatura</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isSuperadmin && viewMode === 'platform' ? (
        <PlatformDashboardView
          platformQuery={platformQuery}
          commercialQuery={commercialQuery}
          onNavigate={onNavigate}
        />
      ) : noModules ? (
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
          year={selectedYear}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

const PlatformDashboardView: React.FC<{
  platformQuery: QueryLike<PlatformSummary>;
  commercialQuery: QueryLike<PlatformCommercialSummary>;
  onNavigate: (module: string) => void;
}> = ({ platformQuery, commercialQuery, onNavigate }) => {
  const platform = platformQuery.data;
  const commercial = commercialQuery.data;

  const isLoading = platformQuery.isLoading || commercialQuery.isLoading;

  if (isLoading) {
    return (
      <GlassCard className="p-8">
        <LoadingBlock message="A carregar indicadores da plataforma SaaS..." />
      </GlassCard>
    );
  }

  const clientStats = platform?.clients;
  const licenseStats = platform?.licenses;
  const moduleAdoption = (platform?.modules || []).map((m) => ({
    name: m.name || m.key,
    value: m.client_count,
  }));

  const monthlyCommercial = (commercial?.monthly || []).map((b) => ({
    label: b.month,
    novasContas: b.count,
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Empresas Clientes"
          icon={Building2}
          iconClass="text-emerald-600 dark:text-emerald-400"
          footer={`${clientStats?.active ?? 0} ativas · ${clientStats?.suspended ?? 0} suspensas`}
        >
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {clientStats?.total ?? 0}
          </div>
        </KpiCard>

        <KpiCard
          label="Licenças Anuais"
          icon={ShieldCheck}
          iconClass="text-blue-600 dark:text-blue-400"
          footer={
            (licenseStats?.expiring_soon ?? 0) > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                ⚠ {licenseStats?.expiring_soon} a expirar em breve
              </span>
            ) : (
              `${licenseStats?.active ?? 0} em estado regular`
            )
          }
        >
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {licenseStats?.total ?? 0}
          </div>
        </KpiCard>

        <KpiCard
          label="Postos de Trabalho"
          icon={Users}
          iconClass="text-purple-600 dark:text-purple-400"
          footer="Utilizadores autorizados na rede"
        >
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {platform?.active_seats ?? 0}
          </div>
        </KpiCard>

        <KpiCard
          label="Novas Contas (Mês)"
          icon={TrendingUp}
          iconClass="text-emerald-600 dark:text-emerald-400"
          footer={
            commercial?.growth_rate !== null && commercial?.growth_rate !== undefined ? (
              <span>
                Crescimento:{' '}
                <b className={commercial.growth_rate >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                  {commercial.growth_rate > 0 ? '+' : ''}
                  {commercial.growth_rate.toFixed(1)}%
                </b>{' '}
                vs mês anterior
              </span>
            ) : (
              `${commercial?.new_last_12m ?? 0} no acumulado de 12 meses`
            )
          }
        >
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {commercial?.new_this_month ?? 0}
          </div>
        </KpiCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Evolução de Novos Clientes"
          subtitle="Adesões comerciais e novos registos nos últimos 12 meses"
        >
          {monthlyCommercial.length === 0 ? (
            <EmptyState message="Sem histórico de adesões comerciais registadas." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyCommercial} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="novasContas" name="Novas Empresas" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Adoção de Módulos" subtitle="Subscrições ativas por componente de negócio">
          {moduleAdoption.length === 0 ? (
            <EmptyState message="Nenhuma informação de módulos disponível." />
          ) : (
            <DonutChart data={moduleAdoption} />
          )}
        </ChartCard>
      </div>

      <GlassCard className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            Consola Central de Operações B2B
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Emita licenças, parametrize módulos subscritos e efetue auditorias cadastrais.
          </p>
        </div>
        <button
          onClick={() => onNavigate('clients')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <span>Abrir Gestão de Clientes</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </GlassCard>
    </div>
  );
};

const CompanyView: React.FC<{
  invoicingQuery: QueryLike<InvoicingDashboardSummary>;
  treasuryQuery: QueryLike<TreasuryDashboardSummary>;
  payrollQuery: QueryLike<PayrollDashboardSummary>;
  inventoryQuery: QueryLike<InventoryDashboardSummary>;
  can: (module: string) => boolean;
  year: number;
  onNavigate: (module: string) => void;
}> = ({
  invoicingQuery,
  treasuryQuery,
  payrollQuery,
  inventoryQuery,
  can,
  year,
  onNavigate,
}) => {
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

  const invoiceCount = invoicing?.totals?.invoicesCount ?? 0;
  const creditNotesCount = invoicing?.totals?.creditNotesCount ?? 0;

  const totalReceivables =
    num(treasury?.receivables?.settled_total) + num(treasury?.receivables?.outstanding_total);
  const recoveryRate =
    totalReceivables > 0
      ? ((num(treasury?.receivables?.settled_total) / totalReceivables) * 100).toFixed(1)
      : null;

  return (
    <>
      {anyLoading && (
        <GlassCard className="p-4 sm:p-5">
          <LoadingBlock message="A carregar indicadores da empresa..." />
        </GlassCard>
      )}

      {invoicingReady && invoicing?.agt && (
        <GlassCard className="p-4 sm:p-5 border-l-4 border-l-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Certificação Fiscal AGT & Integridade Criptográfica
                  </h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cadeia J-1 Válida
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conforme o Decreto Executivo nº 385/20 · Encadeamento de chaves RSA e memória fiscal em conformidade legal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Último Doc. Emitido</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {invoicing.agt.lastDocumentNumber || 'Nenhum emitido'}
                </span>
              </div>
              {invoicing.agt.lastValidationChars && (
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-400">Validação Hash (J-1)</span>
                  <span className="inline-block px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-800 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {invoicing.agt.lastValidationChars}
                  </span>
                </div>
              )}
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-400">Emissões este Mês</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {invoicing.agt.documentsThisMonth} documentos
                </span>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {invoicingReady && (
          <KpiCard
            label="Faturação Emitida"
            icon={TrendingUp}
            iconClass="text-emerald-600 dark:text-emerald-400"
            footer={
              <span>
                {invoiceCount} doc{invoiceCount !== 1 ? 's' : ''} em {year}
                {creditNotesCount > 0 ? ` · ${creditNotesCount} NCs abatidas` : ''}
              </span>
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {invoicingQuery.isLoading ? '—' : <KzAmount value={num(invoicing?.totals?.grossTotal)} />}
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
                Retenção 6,5%: <KzAmount value={num(invoicing?.totals?.withholdingTotal)} />
              </span>
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {invoicingQuery.isLoading ? '—' : <KzAmount value={num(invoicing?.totals?.taxTotal)} />}
            </div>
          </KpiCard>
        )}

        {treasuryReady && (
          <KpiCard
            label="Liquidez Bancária"
            icon={Wallet}
            iconClass="text-blue-600 dark:text-blue-400"
            footer={
              <span>
                {treasury?.liquidity?.active_accounts ?? 0} conta
                {(treasury?.liquidity?.active_accounts ?? 0) !== 1 ? 's' : ''} ativa
                {(treasury?.liquidity?.active_accounts ?? 0) !== 1 ? 's' : ''}
                {treasury?.cash && treasury.cash.open_sessions > 0
                  ? ` · ${treasury.cash.open_sessions} caixa POS aberto`
                  : ''}
              </span>
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {treasuryQuery.isLoading ? '—' : <KzAmount value={num(treasury?.liquidity?.total_balance_aoa)} />}
            </div>
          </KpiCard>
        )}

        {treasuryReady && (
          <KpiCard
            label="Cobranças & Arrecadação"
            icon={Receipt}
            iconClass="text-emerald-600 dark:text-emerald-400"
            footer={
              recoveryRate ? (
                <span>
                  Taxa de liquidação: <b className="text-emerald-600 font-bold">{recoveryRate}%</b>
                </span>
              ) : (
                `${treasury?.receipts?.month_count ?? 0} recibos este mês`
              )
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {treasuryQuery.isLoading ? '—' : <KzAmount value={num(treasury?.receipts?.month_amount)} />}
            </div>
          </KpiCard>
        )}

        {inventoryReady && (
          <KpiCard
            label="Valor do Stock (CMP)"
            icon={Boxes}
            iconClass="text-emerald-600 dark:text-emerald-400"
            footer={
              (inventory?.stock?.low_stock_count ?? 0) > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  ⚠ {inventory?.stock?.low_stock_count} artigo
                  {(inventory?.stock?.low_stock_count ?? 0) !== 1 ? 's' : ''} abaixo do ponto de encomenda
                </span>
              ) : (
                `${inventory?.products?.stockable ?? 0} produtos geridos`
              )
            }
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {inventoryQuery.isLoading ? '—' : <KzAmount value={num(inventory?.stock?.value_by_cost)} />}
            </div>
          </KpiCard>
        )}

        {payrollReady && (
          <KpiCard
            label="Colaboradores no Quadro"
            icon={Users}
            iconClass="text-purple-600 dark:text-purple-400"
            footer={`${payroll?.employees?.on_leave ?? 0} em férias · ${
              payroll?.organization?.departments ?? 0
            } departamentos`}
          >
            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {payrollQuery.isLoading ? '—' : payroll?.employees?.active ?? 0}
            </div>
          </KpiCard>
        )}
      </div>

      {payrollReady && payroll?.latest_period && (
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Massa Salarial & Encargos Sociais (KudibaPayroll)
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  {payroll.latest_period.title || `${payroll.latest_period.month}/${payroll.latest_period.year}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fotografia dos salários processados, IRT retido e contribuição do INSS (8% entidade patronal + 3% colaborador).
              </p>
            </div>
            <button
              onClick={() => onNavigate('payroll')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
            >
              <span>Abrir Folha de Salários</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Total Salários Brutos</span>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1">
                <KzAmount value={num(payroll.latest_period.total_gross)} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Líquido a Pagar</span>
              <div className="text-sm sm:text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                <KzAmount value={num(payroll.latest_period.total_net)} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Retenção IRT</span>
              <div className="text-sm sm:text-base font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                <KzAmount value={num(payroll.latest_period.total_irt)} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <span className="block text-[10px] uppercase font-bold text-slate-400">Segurança Social (INSS)</span>
              <div className="text-sm sm:text-base font-extrabold text-purple-700 dark:text-purple-400 mt-1">
                <KzAmount
                  value={
                    num(payroll.latest_period.total_inss_employee) +
                    num(payroll.latest_period.total_inss_employer)
                  }
                />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Empresa: <KzAmount value={num(payroll.latest_period.total_inss_employer)} />
              </span>
            </div>
          </div>
        </GlassCard>
      )}

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
                <Tooltip contentStyle={tooltipStyle} formatter={moneyFormatter} />
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
          <ChartCard title="IVA por Taxa" subtitle="Repartição do imposto liquidado no exercício">
            <DonutChart data={taxBreakdown} money />
          </ChartCard>
        )}

        {treasuryReady && aging.length > 0 && (
          <ChartCard
            title="Antiguidade da Dívida (Aging)"
            subtitle="Contas a receber por escalão temporal de atraso"
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={tooltipStyle} formatter={moneyFormatter} />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {invoicingReady && (invoicing?.topCustomers?.length ?? 0) > 0 && (
          <ChartCard
            title="Principais Clientes por Faturação"
            subtitle="Top 5 compradores de maior volume no exercício"
            action={
              <button
                onClick={() => onNavigate('invoicing')}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Faturas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoicing?.topCustomers.map((c, i) => (
                <div key={c.customerNif || i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{c.customerName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      NIF {c.customerNif} · {c.invoicesCount} doc{c.invoicesCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 font-bold text-slate-900 dark:text-white">
                    <KzAmount value={num(c.grossTotal)} />
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {inventoryReady && (inventory?.stock?.low_stock_items?.length ?? 0) > 0 && (
          <ChartCard
            title="Alertas de Stock Crítico"
            subtitle="Artigos em rutura ou abaixo do ponto de encomenda"
            action={
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Inventário</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {inventory?.stock.low_stock_items.slice(0, 5).map((item) => (
                <div key={`${item.warehouse_id}-${item.product_id}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      Cód: <span className="font-mono">{item.code}</span> · Armazém: {item.warehouse_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                      <AlertCircle className="w-3 h-3" />
                      {num(item.quantity_on_hand)} / Ponto {num(item.reorder_point)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        )}

        {inventoryReady &&
          (inventory?.stock?.low_stock_items?.length ?? 0) === 0 &&
          (inventory?.stock?.top_value_products?.length ?? 0) > 0 && (
            <ChartCard
              title="Produtos de Maior Valor em Armazém"
              subtitle="Artigos com maior capital imobilizado a CMP"
              action={
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Ver Todos</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {inventory?.stock.top_value_products.map((item) => (
                  <div key={item.product_id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-400">
                        Cód: <span className="font-mono">{item.code}</span> · {num(item.quantity_on_hand)} unid.
                      </p>
                    </div>
                    <div className="text-right shrink-0 font-bold text-slate-900 dark:text-white">
                      <KzAmount value={num(item.value_by_cost)} />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}
      </div>
    </>
  );
};

export default DashboardView;
