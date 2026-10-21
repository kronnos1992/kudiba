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
  UserX,
  Check,
  Clock,
  Printer,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  payrollApi,
  PayrollPeriod,
  Payslip,
  Employee,
  CreateEmployeePayload,
  CreateContractPayload,
  OpenPeriodPayload,
  CreateDepartmentPayload,
  CreateJobPositionPayload,
  CreateVacationPayload,
  ContractType,
} from '../../api/payroll';

type PayrollTab = 'periods' | 'employees' | 'contracts' | 'organization' | 'vacations' | 'absences';

export const PayrollView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<PayrollTab>('periods');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Período
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [confirmClosePeriod, setConfirmClosePeriod] = useState<PayrollPeriod | null>(null);
  const [payslipsSubTab, setPayslipsSubTab] = useState<'payslips' | 'taxes'>('payslips');
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

  // Modal de Férias e Ausências
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [terminateModalEmployee, setTerminateModalEmployee] = useState<Employee | null>(null);
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().slice(0, 10));
  const [terminationReason, setTerminationReason] = useState('Rescisão por mútuo acordo');

  const [absenceForm, setAbsenceForm] = useState({
    employee_id: '',
    absence_date: new Date().toISOString().slice(0, 10),
    absence_type: 'UNJUSTIFIED',
    is_paid: false,
    notes: '',
  });

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

  const { data: absences = [], isLoading: absencesLoading } = useQuery({
    queryKey: ['payroll_absences', activeTenant?.id],
    queryFn: () => payrollApi.listAbsences(),
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

  const terminateEmployeeMutation = useMutation({
    mutationFn: ({ id, termination_date, reason }: { id: string; termination_date: string; reason?: string }) =>
      payrollApi.terminateEmployee(id, { termination_date, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_employees'] });
      setTerminateModalEmployee(null);
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

  const approveVacationMutation = useMutation({
    mutationFn: (id: string) => payrollApi.approveVacation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_vacations'] });
    },
  });

  const rejectVacationMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => payrollApi.rejectVacation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_vacations'] });
    },
  });

  const createAbsenceMutation = useMutation({
    mutationFn: (payload: { employee_id: string; absence_date: string; absence_type?: string; is_paid?: boolean; notes?: string }) =>
      payrollApi.createAbsence(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_absences'] });
      setShowAbsenceModal(false);
      setAbsenceForm({
        employee_id: '',
        absence_date: new Date().toISOString().slice(0, 10),
        absence_type: 'UNJUSTIFIED',
        is_paid: false,
        notes: '',
      });
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

  const handleExportPayrollCsv = (period: PayrollPeriod, payslips: Payslip[]) => {
    const headers = [
      'N.º',
      'Código',
      'Colaborador',
      'NIF',
      'N.º INSS',
      'IBAN',
      'Vencimento Base (Kz)',
      'Subsídios (Kz)',
      'Total Bruto (Kz)',
      'INSS Trabalhador 3% (Kz)',
      'IRT Retido (Kz)',
      'Total Descontos (Kz)',
      'Salário Líquido (Kz)',
      'INSS Patronal 8% (Kz)',
      'Custo Total Empresa (Kz)',
    ];

    const rows = payslips.map((ps, idx) => {
      const emp = employees.find((e) => e.id === ps.employee_id);
      const baseSalary = Number(ps.base_salary) || 0;
      const allowances = Number(ps.total_allowances) || 0;
      const gross = Number(ps.total_gross) || 0;
      const inssEmp = Number(ps.inss_employee) || 0;
      const irt = Number(ps.irt) || 0;
      const deductions = inssEmp + irt;
      const net = Number(ps.net_salary) || 0;
      const inssPatronal = Number(ps.inss_employer) || 0;
      const totalCost = gross + inssPatronal;

      return [
        idx + 1,
        `"${emp?.code || ''}"`,
        `"${emp?.full_name || 'Colaborador'}"`,
        `"${emp?.nif || ''}"`,
        `"${emp?.inss_number || ''}"`,
        `"${emp?.iban || ''}"`,
        baseSalary.toFixed(2),
        allowances.toFixed(2),
        gross.toFixed(2),
        inssEmp.toFixed(2),
        irt.toFixed(2),
        deductions.toFixed(2),
        net.toFixed(2),
        inssPatronal.toFixed(2),
        totalCost.toFixed(2),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mapa_Salarios_${period.year}_${period.month.toString().padStart(2, '0')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePrintPayrollSheet = (period: PayrollPeriod, payslips: Payslip[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Permita janelas de pop-up no navegador para imprimir o Mapa de Salários.');
      return;
    }
    const tenantName = activeTenant?.company_name || activeTenant?.name || 'Kudiba Tecnologia Lda';
    const tenantNif = activeTenant?.taxId || activeTenant?.nif || '5401122334';
    const tenantAddress = activeTenant?.address_detail
      ? `${activeTenant.address_detail}, ${activeTenant.city || 'Luanda'}`
      : 'Luanda, Angola';

    const totalGross = Number(period.total_gross) || 0;
    const totalInssEmp = Number(period.total_inss_employee) || 0;
    const totalInssPat = Number(period.total_inss_employer) || 0;
    const totalIrt = Number(period.total_irt) || 0;
    const totalNet = Number(period.total_net) || 0;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Mapa Geral de Salários - ${period.title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; font-size: 11px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 15px; }
          .company-info h1 { margin: 0 0 4px 0; font-size: 16px; color: #0f766e; }
          .company-info p { margin: 2px 0; color: #64748b; font-size: 11px; }
          .doc-title { text-align: right; }
          .doc-title h2 { margin: 0 0 4px 0; font-size: 14px; text-transform: uppercase; color: #0f172a; }
          .doc-title p { margin: 2px 0; font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; font-size: 9px; padding: 6px 4px; border: 1px solid #cbd5e1; text-align: right; }
          th.left, td.left { text-align: left; }
          td { padding: 5px 4px; border: 1px solid #e2e8f0; font-size: 10px; text-align: right; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .totals-row td { background-color: #e2e8f0; font-weight: 800; border-top: 2px solid #0f766e; }
          .kpis { display: flex; gap: 15px; margin: 15px 0; }
          .kpi-box { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; background: #fafafa; }
          .kpi-title { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .kpi-val { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 3px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
          .sign-col { width: 30%; text-align: center; }
          .sign-line { border-top: 1px solid #000; margin-top: 45px; padding-top: 4px; font-size: 10px; font-weight: bold; }
          @media print {
            body { margin: 10mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${tenantName}</h1>
            <p><strong>NIF:</strong> ${tenantNif} • <strong>Sede:</strong> ${tenantAddress}</p>
            <p>Conforme Lei Geral do Trabalho (LGT 12/23) • IRT (Lei 28/20) • INSS (DP 227/18)</p>
          </div>
          <div class="doc-title">
            <h2>Mapa Geral de Salários</h2>
            <p><strong>Período:</strong> ${period.title}</p>
            <p><strong>Referência:</strong> ${period.month.toString().padStart(2, '0')}/${period.year}</p>
            <p><strong>Emitido em:</strong> ${new Date().toLocaleDateString('pt-AO')}</p>
          </div>
        </div>

        <div class="kpis">
          <div class="kpi-box">
            <div class="kpi-title">Massa Salarial Bruta</div>
            <div class="kpi-val">${totalGross.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">INSS Trabalhador (3%)</div>
            <div class="kpi-val">${totalInssEmp.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Retenção IRT (Lei 28/20)</div>
            <div class="kpi-val">${totalIrt.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">Total Líquido a Transferir</div>
            <div class="kpi-val" style="color: #0f766e;">${totalNet.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-title">INSS Patronal (8%)</div>
            <div class="kpi-val">${totalInssPat.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="left" style="width: 25px;">#</th>
              <th class="left">Colaborador</th>
              <th class="left">NIF</th>
              <th class="left">IBAN</th>
              <th>Venc. Base</th>
              <th>Subsídios</th>
              <th>Total Bruto</th>
              <th>INSS (3%)</th>
              <th>IRT Retido</th>
              <th style="color: #0f766e;">Salário Líquido</th>
              <th>INSS Pat. (8%)</th>
            </tr>
          </thead>
          <tbody>
            ${payslips.map((ps, i) => {
              const emp = employees.find((e) => e.id === ps.employee_id);
              return `
                <tr>
                  <td class="left">${i + 1}</td>
                  <td class="left"><strong>${emp?.full_name || 'Colaborador'}</strong></td>
                  <td class="left">${emp?.nif || '—'}</td>
                  <td class="left" style="font-family: monospace; font-size: 9px;">${emp?.iban || '—'}</td>
                  <td>${Number(ps.base_salary).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                  <td>${Number(ps.total_allowances).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                  <td><strong>${Number(ps.total_gross).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</strong></td>
                  <td style="color: #b91c1c;">-${Number(ps.inss_employee).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                  <td style="color: #7e22ce;">-${Number(ps.irt).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                  <td style="font-weight: bold; color: #0f766e;">${Number(ps.net_salary).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                  <td style="color: #64748b;">${Number(ps.inss_employer).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
                </tr>
              `;
            }).join('')}
            <tr class="totals-row">
              <td colspan="4" class="left">TOTAIS GERAIS (${payslips.length} Colaboradores)</td>
              <td>${payslips.reduce((acc, p) => acc + Number(p.base_salary), 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td>${payslips.reduce((acc, p) => acc + Number(p.total_allowances), 0).toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td>${totalGross.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td style="color: #b91c1c;">-${totalInssEmp.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td style="color: #7e22ce;">-${totalIrt.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td style="color: #0f766e;">${totalNet.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
              <td>${totalInssPat.toLocaleString('pt-AO', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <div class="signatures">
          <div class="sign-col">
            <div class="sign-line">Recursos Humanos<br><span style="font-size: 8px; font-weight: normal; color: #64748b;">Processamento e Assiduidade</span></div>
          </div>
          <div class="sign-col">
            <div class="sign-line">Contabilidade & Fiscalidade<br><span style="font-size: 8px; font-weight: normal; color: #64748b;">Apuramento IRT / INSS</span></div>
          </div>
          <div class="sign-col">
            <div class="sign-line">Direção Financeira / Gerência<br><span style="font-size: 8px; font-weight: normal; color: #64748b;">Autorização de Pagamento</span></div>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Totais agregados do último período
  const latestPeriod = periods[0];
  const activeEmployeesCount =
    employees.filter((e) => e.status === 'ACTIVE').length ||
    employees.length ||
    contracts.filter((c) => c.status === 'ACTIVE').length ||
    contracts.length;
  const totalGrossPayroll = latestPeriod ? Number(latestPeriod.total_gross) : 0;
  const totalIrtPayroll = latestPeriod ? Number(latestPeriod.total_irt) : 0;
  const totalInssPayroll = latestPeriod
    ? Number(latestPeriod.total_inss_employee) + Number(latestPeriod.total_inss_employer)
    : 0;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Identificação */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            <span>Recursos Humanos &amp; Processamento Salarial</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Motor salarial conforme Lei Geral do Trabalho (LGT 12/23), IRT (Lei 28/20), INSS (DP 227/18) e remessas PS2
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'periods' && (
            <button
              onClick={() => setShowPeriodModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Abrir Período Salarial</span>
            </button>
          )}

          {activeTab === 'employees' && (
            <button
              onClick={() => setShowEmployeeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Colaborador</span>
            </button>
          )}

          {activeTab === 'contracts' && (
            <button
              onClick={() => setShowContractModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Contrato</span>
            </button>
          )}

          {activeTab === 'organization' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowDepartmentModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Departamento</span>
              </button>
              <button
                onClick={() => setShowJobPositionModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>Cargo / Posição</span>
              </button>
            </div>
          )}

          {activeTab === 'vacations' && (
            <button
              onClick={() => setShowVacationModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Submeter Férias</span>
            </button>
          )}

          {activeTab === 'absences' && (
            <button
              onClick={() => setShowAbsenceModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Registar Falta / Ausência</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Colaboradores Ativos</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {activeEmployeesCount}
          </div>
          <span className="text-xs text-slate-400">
            {contracts.length} Contrato{contracts.length === 1 ? '' : 's'} Registado{contracts.length === 1 ? '' : 's'}
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Massa Salarial Ilíquida</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalGrossPayroll} />
          </div>
          <span className="text-xs text-slate-400 truncate block">
            {latestPeriod?.title || 'Período Corrente'}
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Retenção de IRT (Lei 28/20)</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalIrtPayroll} />
          </div>
          <span className="text-xs text-purple-600 font-medium">
            Apuramento Fiscal Mensal
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">INSS Total (11%)</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalInssPayroll} />
          </div>
          <span className="text-xs text-slate-400">
            3% Trabalhador + 8% Entidade Patronal
          </span>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('periods')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'periods'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Processamento Salarial &amp; Folhas</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'employees'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Colaboradores</span>
        </button>

        <button
          onClick={() => setActiveTab('contracts')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'contracts'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          <span>Contratos &amp; Vencimentos</span>
        </button>

        <button
          onClick={() => setActiveTab('organization')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'organization'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Departamentos &amp; Cargos</span>
        </button>

        <button
          onClick={() => setActiveTab('vacations')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vacations'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>Férias</span>
        </button>

        <button
          onClick={() => setActiveTab('absences')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'absences'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Assiduidade &amp; Faltas</span>
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
                                title="Ver Recibos & Apuramento Fiscal"
                                className="p-1.5 text-slate-600 hover:text-blue-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                              </button>

                              <button
                                onClick={async () => {
                                  const payslips = await payrollApi.listPeriodPayslips(p.id);
                                  handlePrintPayrollSheet(p, payslips);
                                }}
                                title="Imprimir Mapa Geral de Salários"
                                className="p-1.5 text-slate-600 hover:text-amber-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleExportPs2(p.id)}
                                title="Exportar Remessa Bancária PS2"
                                className="p-1.5 text-slate-600 hover:text-purple-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                              </button>

                              {p.status === 'CALCULATED' && (
                                <button
                                  onClick={() => setConfirmClosePeriod(p)}
                                  title="Fechar Folha Salarial"
                                  className="p-1.5 text-slate-600 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employeesLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar colaboradores...
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
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
                          <td className="px-4 py-3 text-center">
                            {e.status === 'ACTIVE' && (
                              <button
                                onClick={() => {
                                  setTerminateModalEmployee(e);
                                  setTerminationDate(new Date().toISOString().slice(0, 10));
                                  setTerminationReason('Rescisão por mútuo acordo');
                                }}
                                title="Terminar Contrato / Desligamento"
                                className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
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
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {vacations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
                          <td className="px-4 py-3 text-center">
                            {v.status === 'PENDING' && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => approveVacationMutation.mutate(v.id)}
                                  disabled={approveVacationMutation.isPending}
                                  title="Aprovar Férias"
                                  className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    const reason = prompt('Motivo de rejeição:');
                                    if (reason) rejectVacationMutation.mutate({ id: v.id, reason });
                                  }}
                                  disabled={rejectVacationMutation.isPending}
                                  title="Rejeitar Férias"
                                  className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
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

      {/* Tab 6: Assiduidade & Faltas */}
      {activeTab === 'absences' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Colaborador</th>
                    <th className="px-4 py-3">Tipo de Falta</th>
                    <th className="px-4 py-3 text-center">Remunerada?</th>
                    <th className="px-4 py-3">Observações / Justificativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {absencesLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        A carregar registos de assiduidade...
                      </td>
                    </tr>
                  ) : absences.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma falta registada. Clique em "Registar Falta / Ausência" para lançar.
                      </td>
                    </tr>
                  ) : (
                    absences.map((ab: any) => {
                      const emp = employees.find((e) => e.id === ab.employee_id);
                      return (
                        <tr key={ab.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                            {ab.absence_date ? new Date(ab.absence_date).toLocaleDateString('pt-AO') : '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {emp ? `${emp.full_name} (${emp.code})` : ab.employee_id?.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {ab.absence_type || 'Injustificada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge
                              status={ab.is_paid ? 'ok' : 'acompanhar'}
                              label={ab.is_paid ? 'Sim (Remunerada)' : 'Não (Com Desconto)'}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {ab.notes || '—'}
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

      {/* Modal: Recibos do Período Salarial & Apuramento Fiscal */}
      {selectedPeriodPayslips && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
              <div className="flex items-start gap-3">
                {activeTenant?.logo_data_url && (
                  <img
                    src={activeTenant.logo_data_url}
                    alt="Logótipo"
                    className="w-11 h-11 rounded-lg object-contain border border-slate-200 bg-white p-1 shrink-0"
                  />
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    {selectedPeriodPayslips.period.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                    {activeTenant?.company_name || activeTenant?.name || 'Kudiba Comércio Geral, Lda'} • NIF:{' '}
                    <span className="font-mono">{activeTenant?.taxId || activeTenant?.nif || '5401122334'}</span>
                    {activeTenant?.address_detail
                      ? ` • ${activeTenant.address_detail}, ${activeTenant.city || 'Luanda'}`
                      : ''}
                  </p>
                  <span className="text-xs text-slate-400">
                    Total processado: {selectedPeriodPayslips.payslips.length} Colaboradores
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    handleExportPayrollCsv(
                      selectedPeriodPayslips.period,
                      selectedPeriodPayslips.payslips
                    )
                  }
                  title="Exportar Mapa de Salários em CSV/Excel"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handlePrintPayrollSheet(
                      selectedPeriodPayslips.period,
                      selectedPeriodPayslips.payslips
                    )
                  }
                  title="Imprimir Mapa Geral de Salários"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-600" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPs2(selectedPeriodPayslips.period.id)}
                  title="Exportar Remessa Bancária PS2"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors cursor-pointer shadow-sm shadow-purple-600/20"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PS2</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriodPayslips(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Alternador de Vistas: Recibos vs Guias Fiscais */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setPayslipsSubTab('payslips')}
                className={`pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
                  payslipsSubTab === 'payslips'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Recibos de Vencimento ({selectedPeriodPayslips.payslips.length})
              </button>
              <button
                type="button"
                onClick={() => setPayslipsSubTab('taxes')}
                className={`pb-2 px-3 font-semibold border-b-2 transition-colors cursor-pointer ${
                  payslipsSubTab === 'taxes'
                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Guias Fiscais &amp; INSS (Apuramento Modelo 2)
              </button>
            </div>

            {payslipsSubTab === 'payslips' ? (
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
                              className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Guia Modelo 2 IRT */}
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h4 className="font-bold text-sm text-purple-900 dark:text-purple-200">
                          Guia de IRT — Modelo 2
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                        Lei 28/20
                      </span>
                    </div>

                    <p className="text-xs text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                      Retenção na fonte efetuada sobre rendimentos do trabalho por conta de outrem (Grupo A).
                    </p>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg space-y-2 text-xs border border-purple-100 dark:border-purple-900/40">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Massa Salarial Ilíquida Sujeita:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          <KzAmount value={Number(selectedPeriodPayslips.period.total_gross)} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dedução Legal de INSS (3%):</span>
                        <span className="text-rose-600">
                          -<KzAmount value={Number(selectedPeriodPayslips.period.total_inss_employee)} />
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Total IRT a Entregar à Administração Tributária:</span>
                        <span className="font-extrabold text-purple-600 text-sm">
                          <KzAmount value={Number(selectedPeriodPayslips.period.total_irt)} />
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-purple-900/70 dark:text-purple-300/70 flex items-center justify-between">
                      <span>Prazo legal de liquidação:</span>
                      <strong className="text-purple-900 dark:text-purple-200">Até ao último dia útil do mês seguinte</strong>
                    </div>
                  </div>

                  {/* Guia de Pagamento INSS */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-amber-600" />
                        <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                          Guia de Pagamento INSS (11%)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                        DP 227/18
                      </span>
                    </div>

                    <p className="text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Contribuição obrigatória para a Segurança Social (3% trabalhador + 8% entidade patronal).
                    </p>

                    <div className="p-3 bg-white dark:bg-slate-900 rounded-lg space-y-2 text-xs border border-amber-100 dark:border-amber-900/40">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quota Trabalhador (3%):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          <KzAmount value={Number(selectedPeriodPayslips.period.total_inss_employee)} />
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quota Entidade Patronal (8%):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          <KzAmount value={Number(selectedPeriodPayslips.period.total_inss_employer)} />
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Total a Transferir ao INSS:</span>
                        <span className="font-extrabold text-amber-600 text-sm">
                          <KzAmount
                            value={
                              Number(selectedPeriodPayslips.period.total_inss_employee) +
                              Number(selectedPeriodPayslips.period.total_inss_employer)
                            }
                          />
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-amber-900/70 dark:text-amber-300/70 flex items-center justify-between">
                      <span>Prazo legal de liquidação:</span>
                      <strong className="text-amber-900 dark:text-amber-200">Até ao dia 10 do mês seguinte</strong>
                    </div>
                  </div>
                </div>

                {/* Resumo de Custos da Organização */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Custo Total da Empresa com Esta Folha
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Massa Salarial Ilíquida + Encargos Patronais de Segurança Social (8%)
                    </p>
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    <KzAmount
                      value={
                        Number(selectedPeriodPayslips.period.total_gross) +
                        Number(selectedPeriodPayslips.period.total_inss_employer)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPeriodPayslips(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação: Fechar Folha Salarial */}
      {confirmClosePeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Fechar Folha Salarial
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Tem a certeza de que deseja encerrar a folha{' '}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {confirmClosePeriod.title}
                  </strong>{' '}
                  ({confirmClosePeriod.month.toString().padStart(2, '0')}/{confirmClosePeriod.year})?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1.5 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex justify-between">
                <span className="text-slate-500">Massa Salarial Ilíquida:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  <KzAmount value={Number(confirmClosePeriod.total_gross)} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">INSS Total (11%):</span>
                <span className="font-semibold text-amber-600">
                  <KzAmount
                    value={
                      Number(confirmClosePeriod.total_inss_employee) +
                      Number(confirmClosePeriod.total_inss_employer)
                    }
                  />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Retenção de IRT:</span>
                <span className="font-semibold text-purple-600">
                  <KzAmount value={Number(confirmClosePeriod.total_irt)} />
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Total Líquido:</span>
                <span className="font-extrabold text-emerald-600">
                  <KzAmount value={Number(confirmClosePeriod.total_net)} />
                </span>
              </div>
            </div>

            <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/40 leading-relaxed">
              ⚠️ Esta operação torna os cálculos e recibos de vencimento <strong>imutáveis</strong> para efeitos legais e fiscais. Não será possível recalcular a folha após o encerramento.
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClosePeriod(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={closePeriodMutation.isPending}
                onClick={() => {
                  closePeriodMutation.mutate(confirmClosePeriod.id);
                  setConfirmClosePeriod(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-rose-600/20"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirmar e Encerrar Folha</span>
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

      {/* Modal: Registar Ausência / Falta */}
      {showAbsenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Registar Falta / Ausência
              </h3>
              <button onClick={() => setShowAbsenceModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Colaborador *
                </label>
                <select
                  value={absenceForm.employee_id}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, employee_id: e.target.value })}
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Data da Falta *
                </label>
                <input
                  type="date"
                  required
                  value={absenceForm.absence_date}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, absence_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo de Ausência *
                </label>
                <select
                  value={absenceForm.absence_type}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, absence_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="UNJUSTIFIED">Injustificada (com desconto salarial)</option>
                  <option value="JUSTIFIED">Justificada (motivo de força maior)</option>
                  <option value="SICK_LEAVE">Baixa Médica / Doença</option>
                  <option value="MATERNITY_PATERNITY">Licença de Maternidade / Paternidade</option>
                  <option value="BEREAVEMENT">Nojo / Luto Familiar</option>
                  <option value="OTHER">Outro Motivo Regulamentar</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={absenceForm.is_paid}
                    onChange={(e) => setAbsenceForm({ ...absenceForm, is_paid: e.target.checked })}
                    className="rounded text-emerald-600"
                  />
                  <span>Falta Remunerada (não desconta do salário)</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Observações / Justificativo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Atestado médico entregue aos RH"
                  value={absenceForm.notes}
                  onChange={(e) => setAbsenceForm({ ...absenceForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowAbsenceModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!absenceForm.employee_id || createAbsenceMutation.isPending}
                onClick={() => createAbsenceMutation.mutate(absenceForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                {createAbsenceMutation.isPending ? 'A registar...' : 'Gravar Falta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rescisão de Colaborador */}
      {terminateModalEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
                <UserX className="w-5 h-5 text-rose-600" />
                Rescisão de Contrato de Trabalho
              </h3>
              <button onClick={() => setTerminateModalEmployee(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1">
              <p className="font-bold">Colaborador: {terminateModalEmployee.full_name} ({terminateModalEmployee.code})</p>
              <p>Esta ação marcará o colaborador como desligado/terminado na plataforma nos termos da LGT 12/23.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Data de Rescisão *
                </label>
                <input
                  type="date"
                  required
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Motivo da Rescisão *
                </label>
                <input
                  type="text"
                  required
                  value={terminationReason}
                  onChange={(e) => setTerminationReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTerminateModalEmployee(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={terminateEmployeeMutation.isPending}
                onClick={() =>
                  terminateEmployeeMutation.mutate({
                    id: terminateModalEmployee.id,
                    termination_date: terminationDate,
                    reason: terminationReason,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
              >
                {terminateEmployeeMutation.isPending ? 'A rescindir...' : 'Confirmar Rescisão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
