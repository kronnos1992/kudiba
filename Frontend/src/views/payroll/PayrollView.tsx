import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  Calendar,
  FileText,
  DollarSign,
  PlusCircle,
  Calculator,
  Download,
  Building2,
  X,
  Search,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  payrollApi,
  PayrollPeriod,
  Payslip,
  CreateEmployeePayload,
  CreateContractPayload,
  OpenPeriodPayload,
  CreateDepartmentPayload,
  CreateJobPositionPayload,
  CreateVacationPayload,
  ContractType,
} from '../../api/payroll';

type PayrollTab = 'periods' | 'employees' | 'contracts' | 'organization' | 'vacations';

export const PayrollView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PayrollTab>('periods');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Período
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [selectedPeriodPayslips, setSelectedPeriodPayslips] = useState<{
    period: PayrollPeriod;
    payslips: Payslip[];
  } | null>(null);

  // Modais de Colaborador e Contrato
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  // Modais de Organização
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showJobPositionModal, setShowJobPositionModal] = useState(false);

  // Modal de Férias
  const [showVacationModal, setShowVacationModal] = useState(false);

  // Formulário de Período
  const [periodForm, setPeriodForm] = useState<OpenPeriodPayload>({
    title: 'Folha de Salários - Novembro 2026',
    year: 2026,
    month: 11,
    start_date: '2026-11-01',
    end_date: '2026-11-30',
  });

  // Formulário de Colaborador
  const [employeeForm, setEmployeeForm] = useState<CreateEmployeePayload>({
    code: '',
    full_name: '',
    nif: '',
    identity_card_number: '',
    iban: 'AO06',
    hire_date: '2026-01-01',
    inss_number: '',
    birth_date: '1995-01-01',
    gender: 'MASCULINO',
    marital_status: 'SOLTEIRO',
    dependents_count: 0,
    email: '',
    phone: '',
    bank_code: 'BAI',
    address: 'Luanda, Angola',
  });

  // Formulário de Contrato
  const [contractForm, setContractForm] = useState({
    employee_id: '',
    contract_type: 'PERMANENT' as ContractType,
    start_date: '2026-01-01',
    base_salary: '500000.00',
    job_position_id: '',
    food_allowance: '50000.00',
    transport_allowance: '40000.00',
  });

  // Formulários de Organização
  const [departmentForm, setDepartmentForm] = useState<CreateDepartmentPayload>({
    code: '',
    name: '',
    description: '',
  });

  const [jobPositionForm, setJobPositionForm] = useState<CreateJobPositionPayload>({
    code: '',
    title: '',
    department_id: '',
    base_salary_min: '300000.00',
    base_salary_max: '800000.00',
  });

  // Formulário de Férias
  const [vacationForm, setVacationForm] = useState<CreateVacationPayload>({
    employee_id: '',
    start_date: '2026-12-01',
    end_date: '2026-12-22',
    days: 22,
    notes: 'Férias anuais regulamentares',
  });

  // Queries
  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['payroll_periods', activeTenant?.id],
    queryFn: () => payrollApi.listPeriods(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['payroll_employees', activeTenant?.id],
    queryFn: () => payrollApi.listEmployees(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['payroll_contracts', activeTenant?.id],
    queryFn: () => payrollApi.listContracts(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['payroll_departments', activeTenant?.id],
    queryFn: () => payrollApi.listDepartments(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: jobPositions = [] } = useQuery({
    queryKey: ['payroll_job_positions', activeTenant?.id],
    queryFn: () => payrollApi.listJobPositions(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: vacations = [] } = useQuery({
    queryKey: ['payroll_vacations', activeTenant?.id],
    queryFn: () => payrollApi.listVacations(),
    enabled: Boolean(activeTenant?.id),
  });

  // Mutations
  const openPeriodMutation = useMutation({
    mutationFn: (payload: OpenPeriodPayload) => payrollApi.openPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_periods'] });
      setShowPeriodModal(false);
    },
  });

  const calculatePeriodMutation = useMutation({
    mutationFn: (id: string) => payrollApi.calculatePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_periods'] });
    },
  });

  const closePeriodMutation = useMutation({
    mutationFn: (id: string) => payrollApi.closePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_periods'] });
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => payrollApi.createEmployee(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_employees'] });
      setShowEmployeeModal(false);
      setEmployeeForm({
        code: '',
        full_name: '',
        nif: '',
        identity_card_number: '',
        iban: 'AO06',
        hire_date: '2026-01-01',
        inss_number: '',
        birth_date: '1995-01-01',
        gender: 'MASCULINO',
        marital_status: 'SOLTEIRO',
        dependents_count: 0,
        email: '',
        phone: '',
        bank_code: 'BAI',
        address: 'Luanda, Angola',
      });
    },
  });

  const createContractMutation = useMutation({
    mutationFn: (payload: CreateContractPayload) => payrollApi.createContract(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_contracts'] });
      setShowContractModal(false);
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => payrollApi.createDepartment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_departments'] });
      setShowDepartmentModal(false);
    },
  });

  const createJobPositionMutation = useMutation({
    mutationFn: (payload: CreateJobPositionPayload) => payrollApi.createJobPosition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_job_positions'] });
      setShowJobPositionModal(false);
    },
  });

  const requestVacationMutation = useMutation({
    mutationFn: (payload: CreateVacationPayload) => payrollApi.requestVacation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_vacations'] });
      setShowVacationModal(false);
    },
  });

  const handleExportPs2 = async (periodId: string) => {
    try {
      const res = await payrollApi.exportPs2(periodId, {
        company_name: activeTenant?.company_name || 'Kudiba Comercial Lda',
        company_nif: activeTenant?.taxId || '5001234567',
        company_iban: 'AO06004000001234567890123',
      });
      const blob = new Blob([res.content], { type: 'text/plain;charset=iso-8859-1' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar ficheiro de remessa bancária PS2.');
    }
  };

  const handleDownloadPayslipPdf = async (payslipId: string, employeeName: string) => {
    try {
      const blob = await payrollApi.getPayslipPdfBlob(payslipId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Recibo_Vencimento_${employeeName.replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao transferir PDF do recibo.');
    }
  };

  // Totais agregados do último período
  const latestPeriod = periods[0];
  const totalGrossPayroll = latestPeriod ? Number(latestPeriod.total_gross) : 0;
  const totalIrtPayroll = latestPeriod ? Number(latestPeriod.total_irt) : 0;
  const totalInssPayroll = latestPeriod
    ? Number(latestPeriod.total_inss_employee) + Number(latestPeriod.total_inss_employer)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header & Identificação */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Recursos Humanos &amp; Processamento Salarial
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor salarial conforme Lei Geral do Trabalho (LGT 12/23), IRT (Lei 28/20), INSS (DP 227/18) e remessas PS2
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'periods' && (
            <button
              onClick={() => setShowPeriodModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Abrir Período Salarial
            </button>
          )}

          {activeTab === 'employees' && (
            <button
              onClick={() => setShowEmployeeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Novo Colaborador
            </button>
          )}

          {activeTab === 'contracts' && (
            <button
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Novo Contrato
            </button>
          )}

          {activeTab === 'organization' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDepartmentModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Departamento
              </button>
              <button
                onClick={() => setShowJobPositionModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Cargo / Posição
              </button>
            </div>
          )}

          {activeTab === 'vacations' && (
            <button
              onClick={() => setShowVacationModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Submeter Férias
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Colaboradores Ativos</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {employees.length}
          </div>
          <span className="text-xs text-slate-400">
            {contracts.length} Contratos Registados
          </span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Massa Salarial Ilíquida</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            <KzAmount value={totalGrossPayroll} />
          </div>
          <span className="text-xs text-slate-400">
            {latestPeriod?.title || 'Período Corrente'}
          </span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Retenção de IRT (Lei 28/20)</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            <KzAmount value={totalIrtPayroll} />
          </div>
          <span className="text-xs text-purple-600 font-medium">
            Apuramento Fiscal Mensal
          </span>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">INSS Total (11%)</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            <KzAmount value={totalInssPayroll} />
          </div>
          <span className="text-xs text-slate-400">
            3% Trabalhador + 8% Entidade Patronal
          </span>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1">
        <button
          onClick={() => setActiveTab('periods')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'periods'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Processamento Salarial &amp; Folhas
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'employees'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Colaboradores
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contracts'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Contratos &amp; Vencimentos
        </button>

        <button
          onClick={() => setActiveTab('organization')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'organization'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departamentos &amp; Cargos
        </button>

        <button
          onClick={() => setActiveTab('vacations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vacations'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Férias &amp; Ausências
        </button>
      </div>

      {/* Tab 1: Períodos Salariais */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Período / Folha</th>
                    <th className="px-4 py-3">Ano / Mês</th>
                    <th className="px-4 py-3 text-right">Total Bruto</th>
                    <th className="px-4 py-3 text-right">INSS (11%)</th>
                    <th className="px-4 py-3 text-right">IRT Retido</th>
                    <th className="px-4 py-3 text-right">Total Líquido</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {periodsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar períodos salariais...
                      </td>
                    </tr>
                  ) : periods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhum período salarial aberto. Clique em "Abrir Período Salarial" para iniciar.
                      </td>
                    </tr>
                  ) : (
                    periods.map((p) => {
                      const totalInss =
                        Number(p.total_inss_employee) + Number(p.total_inss_employer);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {p.title}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-500">
                            {p.month.toString().padStart(2, '0')}/{p.year}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            <KzAmount value={Number(p.total_gross)} />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                            <KzAmount value={totalInss} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-600">
                            <KzAmount value={Number(p.total_irt)} />
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-emerald-600">
                            <KzAmount value={Number(p.total_net)} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                p.status === 'CLOSED'
                                  ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                  : p.status === 'CALCULATED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {p.status === 'CLOSED'
                                ? 'Encerrado'
                                : p.status === 'CALCULATED'
                                ? 'Calculado'
                                : 'Em Aberto'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {p.status !== 'CLOSED' && (
                                <button
                                  onClick={() => calculatePeriodMutation.mutate(p.id)}
                                  title="Calcular Folha"
                                  className="p-1.5 text-slate-600 hover:text-emerald-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <Calculator className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={async () => {
                                  const payslips = await payrollApi.listPeriodPayslips(p.id);
                                  setSelectedPeriodPayslips({ period: p, payslips });
                                }}
                                title="Ver Recibos de Vencimento"
                                className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleExportPs2(p.id)}
                                title="Exportar Remessa Bancária PS2"
                                className="p-1.5 text-slate-600 hover:text-purple-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {p.status === 'CALCULATED' && (
                                <button
                                  onClick={() => closePeriodMutation.mutate(p.id)}
                                  title="Fechar Folha Salarial"
                                  className="p-1.5 text-slate-600 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                              )}
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

      {/* Tab 2: Colaboradores */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar colaborador por nome, BI ou NIF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Nome Completo</th>
                    <th className="px-4 py-3">NIF / BI</th>
                    <th className="px-4 py-3">N.º INSS</th>
                    <th className="px-4 py-3">IBAN Angolano</th>
                    <th className="px-4 py-3">Admissão</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        A carregar colaboradores...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhum colaborador cadastrado. Clique em "Novo Colaborador" para registar.
                      </td>
                    </tr>
                  ) : (
                    employees
                      .filter(
                        (e) =>
                          e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.nif.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                            {e.code}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-900 dark:text-white block">
                              {e.full_name}
                            </span>
                            <span className="text-xs text-slate-400 block">{e.email || '—'}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">
                            <div>BI: {e.identity_card_number}</div>
                            <div>NIF: {e.nif}</div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                            {e.inss_number || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-emerald-600 font-semibold">
                            {e.iban}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(e.hire_date).toLocaleDateString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge
                              status={e.status === 'ACTIVE' ? 'ok' : 'acompanhar'}
                              label={e.status === 'ACTIVE' ? 'Ativo' : e.status}
                            />
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

      {/* Tab 3: Contratos & Pacotes Salariais */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Tipo de Contrato</th>
                    <th className="px-4 py-3">Data Início</th>
                    <th className="px-4 py-3 text-right">Salário Base</th>
                    <th className="px-4 py-3">Subsídios / Componentes</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {contractsLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        A carregar contratos...
                      </td>
                    </tr>
                  ) : contracts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhum contrato registado.
                      </td>
                    </tr>
                  ) : (
                    contracts.map((c) => {
                      const emp = employees.find((e) => e.id === c.employee_id);
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {emp ? `${emp.full_name} (${emp.code})` : c.employee_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                              {c.contract_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(c.start_date).toLocaleDateString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            <KzAmount value={Number(c.base_salary)} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {c.components && c.components.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.components.map((comp) => (
                                  <span
                                    key={comp.id}
                                    className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-medium text-[11px]"
                                  >
                                    {comp.name}: {Number(comp.amount).toLocaleString('pt-AO')} Kz
                                  </span>
                                ))}
                              </div>
                            ) : (
                              'Sem subsídios'
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status="ok" label="Ativo" />
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

      {/* Tab 4: Departamentos & Cargos */}
      {activeTab === 'organization' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Departamentos da Empresa
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {departments.length === 0 ? (
                <div className="py-4 text-xs text-slate-500">Nenhum departamento registado.</div>
              ) : (
                departments.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                        {d.name}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{d.code}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Cargos &amp; Carreiras
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobPositions.length === 0 ? (
                <div className="py-4 text-xs text-slate-500">Nenhum cargo registado.</div>
              ) : (
                jobPositions.map((j) => (
                  <div key={j.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                        {j.title}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{j.code}</span>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-slate-400 block">Faixa Salarial:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {Number(j.base_salary_min).toLocaleString('pt-AO')} -{' '}
                        {Number(j.base_salary_max).toLocaleString('pt-AO')} Kz
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Tab 5: Férias & Ausências */}
      {activeTab === 'vacations' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Início</th>
                    <th className="px-4 py-3">Fim</th>
                    <th className="px-4 py-3 text-right">Dias Úteis</th>
                    <th className="px-4 py-3">Observações</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vacations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Nenhum pedido de férias registado.
                      </td>
                    </tr>
                  ) : (
                    vacations.map((v) => {
                      const emp = employees.find((e) => e.id === v.employee_id);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {emp ? emp.full_name : v.employee_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(v.start_date).toLocaleDateString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(v.end_date).toLocaleDateString('pt-AO')}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            {v.days} dias
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{v.notes || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {v.status}
                            </span>
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

      {/* Modal: Abrir Novo Período Salarial */}
      {showPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Abrir Novo Período Salarial
              </h3>
              <button onClick={() => setShowPeriodModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Designação do Período *
                </label>
                <input
                  type="text"
                  required
                  value={periodForm.title}
                  onChange={(e) => setPeriodForm({ ...periodForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Ano *
                  </label>
                  <input
                    type="number"
                    value={periodForm.year}
                    onChange={(e) => setPeriodForm({ ...periodForm, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Mês *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={periodForm.month}
                    onChange={(e) => setPeriodForm({ ...periodForm, month: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data Início *
                  </label>
                  <input
                    type="date"
                    value={periodForm.start_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data Fim *
                  </label>
                  <input
                    type="date"
                    value={periodForm.end_date}
                    onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowPeriodModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={openPeriodMutation.isPending}
                onClick={() => openPeriodMutation.mutate(periodForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Abrir Período
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Recibos do Período Salarial */}
      {selectedPeriodPayslips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Recibos de Vencimento: {selectedPeriodPayslips.period.title}
                </h3>
                <span className="text-xs text-slate-400">
                  Total processado: {selectedPeriodPayslips.payslips.length} Colaboradores
                </span>
              </div>
              <button onClick={() => setSelectedPeriodPayslips(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Colaborador</th>
                    <th className="px-3 py-2 text-right">Vencimento Base</th>
                    <th className="px-3 py-2 text-right">Subsídios</th>
                    <th className="px-3 py-2 text-right">Total Bruto</th>
                    <th className="px-3 py-2 text-right">INSS (3%)</th>
                    <th className="px-3 py-2 text-right">IRT Retido</th>
                    <th className="px-3 py-2 text-right font-bold text-emerald-600">Salário Líquido</th>
                    <th className="px-3 py-2 text-center">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPeriodPayslips.payslips.map((ps) => {
                    const emp = employees.find((e) => e.id === ps.employee_id);
                    const empName = emp ? emp.full_name : 'Colaborador';
                    return (
                      <tr key={ps.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                          {empName}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <KzAmount value={Number(ps.base_salary)} />
                        </td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          <KzAmount value={Number(ps.total_allowances)} />
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                          <KzAmount value={Number(ps.total_gross)} />
                        </td>
                        <td className="px-3 py-2 text-right text-rose-600">
                          -<KzAmount value={Number(ps.inss_employee)} />
                        </td>
                        <td className="px-3 py-2 text-right text-purple-600 font-semibold">
                          -<KzAmount value={Number(ps.irt)} />
                        </td>
                        <td className="px-3 py-2 text-right font-extrabold text-emerald-600 text-sm">
                          <KzAmount value={Number(ps.net_salary)} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleDownloadPayslipPdf(ps.id, empName)}
                            className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Descarregar Recibo em PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPeriodPayslips(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Colaborador */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Cadastrar Novo Colaborador
              </h3>
              <button onClick={() => setShowEmployeeModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código do Colaborador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: EMP-002"
                  value={employeeForm.code}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Ana Maria da Silva"
                  value={employeeForm.full_name}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Bilhete de Identidade (BI) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="001234567LA032"
                  value={employeeForm.identity_card_number}
                  onChange={(e) =>
                    setEmployeeForm({
                      ...employeeForm,
                      identity_card_number: e.target.value,
                      nif: employeeForm.nif || e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  NIF (Angola) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="001234567LA032"
                  value={employeeForm.nif}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, nif: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  N.º de Segurança Social (INSS)
                </label>
                <input
                  type="text"
                  placeholder="ex: INSS-123456"
                  value={employeeForm.inss_number || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, inss_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  IBAN para Pagamento (AO06) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AO06 0040 0000 1234 5678 9012 3"
                  value={employeeForm.iban}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, iban: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Data de Admissão *
                </label>
                <input
                  type="date"
                  required
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="colaborador@empresa.ao"
                  value={employeeForm.email || ''}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !employeeForm.code ||
                  !employeeForm.full_name ||
                  !employeeForm.identity_card_number ||
                  !employeeForm.iban ||
                  createEmployeeMutation.isPending
                }
                onClick={() => createEmployeeMutation.mutate(employeeForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Colaborador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Contrato */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                Celebrar Contrato de Trabalho
              </h3>
              <button onClick={() => setShowContractModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Colaborador *
                </label>
                <select
                  value={contractForm.employee_id}
                  onChange={(e) => setContractForm({ ...contractForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o colaborador...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Tipo de Contrato *
                  </label>
                  <select
                    value={contractForm.contract_type}
                    onChange={(e) =>
                      setContractForm({
                        ...contractForm,
                        contract_type: e.target.value as ContractType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="PERMANENT">Tempo Indeterminado (Efetivo)</option>
                    <option value="FIXED_TERM">Termo Certo</option>
                    <option value="PROBATION">Período Probatório</option>
                    <option value="INTERNSHIP">Estágio Profissional</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Salário Base Mensal (Kz) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={contractForm.base_salary}
                    onChange={(e) => setContractForm({ ...contractForm, base_salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Subsídio Alimentação (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={contractForm.food_allowance}
                    onChange={(e) => setContractForm({ ...contractForm, food_allowance: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Subsídio Transporte (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={contractForm.transport_allowance}
                    onChange={(e) =>
                      setContractForm({ ...contractForm, transport_allowance: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!contractForm.employee_id || createContractMutation.isPending}
                onClick={() =>
                  createContractMutation.mutate({
                    employee_id: contractForm.employee_id,
                    contract_type: contractForm.contract_type,
                    start_date: contractForm.start_date,
                    base_salary: contractForm.base_salary,
                    job_position_id: contractForm.job_position_id || undefined,
                    components: [
                      {
                        component_type: 'FOOD_ALLOWANCE',
                        name: 'Subsídio de Alimentação',
                        amount: contractForm.food_allowance,
                        is_taxable_irt: false,
                        is_taxable_inss: false,
                      },
                      {
                        component_type: 'TRANSPORT_ALLOWANCE',
                        name: 'Subsídio de Transporte',
                        amount: contractForm.transport_allowance,
                        is_taxable_irt: false,
                        is_taxable_inss: false,
                      },
                    ],
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Departamento */}
      {showDepartmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Criar Novo Departamento
              </h3>
              <button onClick={() => setShowDepartmentModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código do Departamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: DEP-FIN ou DEP-RH"
                  value={departmentForm.code}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome do Departamento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Recursos Humanos e Cultura"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDepartmentModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!departmentForm.code || !departmentForm.name || createDepartmentMutation.isPending}
                onClick={() => createDepartmentMutation.mutate(departmentForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Criar Departamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Cargo */}
      {showJobPositionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                Criar Novo Cargo
              </h3>
              <button onClick={() => setShowJobPositionModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código do Cargo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: CONT-PL"
                  value={jobPositionForm.code}
                  onChange={(e) => setJobPositionForm({ ...jobPositionForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Título do Cargo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Contabilista Pleno"
                  value={jobPositionForm.title}
                  onChange={(e) => setJobPositionForm({ ...jobPositionForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Salário Mínimo (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={jobPositionForm.base_salary_min}
                    onChange={(e) =>
                      setJobPositionForm({ ...jobPositionForm, base_salary_min: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Salário Máximo (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={jobPositionForm.base_salary_max}
                    onChange={(e) =>
                      setJobPositionForm({ ...jobPositionForm, base_salary_max: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowJobPositionModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!jobPositionForm.code || !jobPositionForm.title || createJobPositionMutation.isPending}
                onClick={() => createJobPositionMutation.mutate(jobPositionForm)}
                className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Criar Cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Submeter Férias */}
      {showVacationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Submeter Pedido de Férias
              </h3>
              <button onClick={() => setShowVacationModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Colaborador *
                </label>
                <select
                  value={vacationForm.employee_id}
                  onChange={(e) => setVacationForm({ ...vacationForm, employee_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o colaborador...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={vacationForm.start_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Data Fim *
                  </label>
                  <input
                    type="date"
                    required
                    value={vacationForm.end_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={vacationForm.notes || ''}
                  onChange={(e) => setVacationForm({ ...vacationForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowVacationModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!vacationForm.employee_id || requestVacationMutation.isPending}
                onClick={() => requestVacationMutation.mutate(vacationForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Submeter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
