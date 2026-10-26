import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  Scale,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  Search,
  Lock,
  Calendar,
  Check,
  X,
  CheckSquare,
  AlertOctagon,
  RefreshCw,
  Activity,
  Users,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import {
  payrollApi,
  Department,
  Employee,
} from '../../api/payroll';

interface ConflictManagementTabProps {
  departments: Department[];
  employees: Employee[];
}

type DetailTab = 'overview' | 'participants' | 'meetings' | 'actions' | 'followup' | 'audit';

export const ConflictManagementTab: React.FC<ConflictManagementTabProps> = ({
  departments,
  employees,
}) => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('overview');

  // Modais
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  // Forms
  const [newCaseForm, setNewCaseForm] = useState({
    title: '',
    conflict_type: 'INTERPESSOAL',
    severity: 'MEDIA',
    department_id: '',
    incident_date: new Date().toISOString().slice(0, 10),
    is_confidential: false,
    complainant_name: '',
    complainant_employee_id: '',
    respondent_name: '',
    respondent_employee_id: '',
    summary: '',
    retaliation_risk: false,
    urgent_protection_measures: '',
  });

  const [triageForm, setTriageForm] = useState({
    severity: 'MEDIA',
    resolution_route: 'MEDIACAO',
    assigned_mediator_name: '',
    retaliation_risk: false,
    urgent_protection_measures: '',
    status: 'EM_MEDIACAO',
  });

  const [statusForm, setStatusForm] = useState({
    status: 'RESOLVIDO',
    closure_reason: '',
  });

  const [participantForm, setParticipantForm] = useState({
    name: '',
    employee_id: '',
    role: 'WITNESS',
    statement: '',
    has_conflict_of_interest: false,
    conflict_of_interest_details: '',
  });

  const [meetingForm, setMeetingForm] = useState({
    meeting_type: 'JOINT_MEDIATION',
    scheduled_at: new Date().toISOString().slice(0, 16),
    location: 'Gabinete RH Confidencial',
    conducted_by: '',
    attendees: '',
    minutes: '',
    agreed_points: '',
    status: 'COMPLETED',
  });

  const [actionForm, setActionForm] = useState({
    title: '',
    description: '',
    action_type: 'COMPROMISSO_CONDUTA',
    assigned_to: '',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });

  const [followUpForm, setFollowUpForm] = useState({
    review_date: new Date().toISOString().slice(0, 10),
    reviewed_by: '',
    feedback_complainant: '',
    feedback_respondent: '',
    retaliation_detected: false,
    is_stable: true,
    notes: '',
  });

  // Queries
  const { data: dashboard } = useQuery({
    queryKey: ['conflict_dashboard'],
    queryFn: () => payrollApi.getConflictDashboard(),
    refetchInterval: 30000,
  });

  const { data: cases = [], isLoading: isLoadingCases } = useQuery({
    queryKey: ['conflict_cases', statusFilter, severityFilter, searchTerm],
    queryFn: () =>
      payrollApi.listConflicts({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
        search: searchTerm.trim() ? searchTerm.trim() : undefined,
      }),
  });

  // Caso Selecionado
  const activeCaseId = selectedCaseId || (cases.length > 0 ? cases[0].id : null);

  const { data: selectedCaseDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['conflict_detail', activeCaseId],
    queryFn: () => (activeCaseId ? payrollApi.getConflict(activeCaseId) : null),
    enabled: !!activeCaseId,
  });

  // Mutations
  const createCaseMutation = useMutation({
    mutationFn: (payload: any) => payrollApi.createConflict(payload),
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['conflict_cases'] });
      queryClient.invalidateQueries({ queryKey: ['conflict_dashboard'] });
      setShowNewCaseModal(false);
      setSelectedCaseId(newCase.id);
      setNewCaseForm({
        title: '',
        conflict_type: 'INTERPESSOAL',
        severity: 'MEDIA',
        department_id: '',
        incident_date: new Date().toISOString().slice(0, 10),
        is_confidential: false,
        complainant_name: '',
        complainant_employee_id: '',
        respondent_name: '',
        respondent_employee_id: '',
        summary: '',
        retaliation_risk: false,
        urgent_protection_measures: '',
      });
    },
  });

  const triageMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.triageConflict(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_cases'] });
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      queryClient.invalidateQueries({ queryKey: ['conflict_dashboard'] });
      setShowTriageModal(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.updateConflictStatus(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_cases'] });
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      queryClient.invalidateQueries({ queryKey: ['conflict_dashboard'] });
      setShowStatusModal(false);
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.addConflictParticipant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      setShowParticipantModal(false);
      setParticipantForm({
        name: '',
        employee_id: '',
        role: 'WITNESS',
        statement: '',
        has_conflict_of_interest: false,
        conflict_of_interest_details: '',
      });
    },
  });

  const createMeetingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.createConflictMeeting(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      queryClient.invalidateQueries({ queryKey: ['conflict_cases'] });
      setShowMeetingModal(false);
      setMeetingForm({
        meeting_type: 'JOINT_MEDIATION',
        scheduled_at: new Date().toISOString().slice(0, 16),
        location: 'Gabinete RH Confidencial',
        conducted_by: '',
        attendees: '',
        minutes: '',
        agreed_points: '',
        status: 'COMPLETED',
      });
    },
  });

  const createActionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.createConflictAction(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      queryClient.invalidateQueries({ queryKey: ['conflict_cases'] });
      setShowActionModal(false);
      setActionForm({
        title: '',
        description: '',
        action_type: 'COMPROMISSO_CONDUTA',
        assigned_to: '',
        due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      });
    },
  });

  const updateActionMutation = useMutation({
    mutationFn: ({ actionId, payload }: { actionId: string; payload: any }) =>
      payrollApi.updateConflictAction(actionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
    },
  });

  const createFollowUpMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      payrollApi.createConflictFollowUp(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conflict_detail', activeCaseId] });
      setShowFollowUpModal(false);
      setFollowUpForm({
        review_date: new Date().toISOString().slice(0, 10),
        reviewed_by: '',
        feedback_complainant: '',
        feedback_respondent: '',
        retaliation_detected: false,
        is_stable: true,
        notes: '',
      });
    },
  });

  // Helpers de Formatação
  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICA':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800';
      case 'ALTA':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      case 'MEDIA':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
      case 'BAIXA':
      default:
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'EM_TRIAGEM':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300';
      case 'EM_MEDIACAO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
      case 'EM_INVESTIGACAO':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
      case 'EM_ACOMPANHAMENTO':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300';
      case 'RESOLVIDO':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
      case 'ENCAMINHADO_DISCIPLINAR':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
      case 'ENCERRADO':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const formatStatusLabel = (st: string) => {
    switch (st) {
      case 'EM_TRIAGEM':
        return 'Em Triagem';
      case 'EM_MEDIACAO':
        return 'Em Mediação';
      case 'EM_INVESTIGACAO':
        return 'Em Investigação';
      case 'EM_ACOMPANHAMENTO':
        return 'Em Acompanhamento';
      case 'RESOLVIDO':
        return 'Resolvido';
      case 'ENCAMINHADO_DISCIPLINAR':
        return 'Encaminhado Disciplinar';
      case 'ENCERRADO':
        return 'Encerrado';
      default:
        return st;
    }
  };

  const formatTypeLabel = (tp: string) => {
    switch (tp) {
      case 'INTERPESSOAL':
        return 'Interpessoal';
      case 'CONDICOES_TRABALHO':
        return 'Condições de Trabalho';
      case 'ASSEDIO_MORAL':
        return 'Assédio Moral';
      case 'ASSEDIO_SEXUAL':
        return 'Assédio Sexual';
      case 'SALARIAL':
        return 'Salarial / Enquadramento';
      case 'DISCIPLINAR':
        return 'Disciplinar';
      default:
        return tp;
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'COMPLAINANT':
        return 'Reclamante / Denunciante';
      case 'RESPONDENT':
        return 'Parte Envolvida / Denunciada';
      case 'WITNESS':
        return 'Testemunha';
      case 'MEDIATOR':
        return 'Mediador(a)';
      case 'INVESTIGATOR':
        return 'Instrutor(a) de Inquérito';
      case 'DEPARTMENT_HEAD':
        return 'Chefia Direta';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs no topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GlassCard className="p-4 border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Processos Ativos</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {dashboard ? dashboard.open_cases : 0}
          </div>
          <span className="text-xs text-slate-400">
            {dashboard?.in_mediation || 0} em mediação • {dashboard?.in_investigation || 0} em inquérito
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Mediações em Curso</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {dashboard ? dashboard.in_mediation : 0}
          </div>
          <span className="text-xs text-slate-400">
            Resolução consensual voluntária
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-red-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Risco de Retaliação</span>
            <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {dashboard ? dashboard.high_retaliation_risk : 0}
          </div>
          <span className="text-xs text-red-500 font-medium">
            Medidas cautelares LGT art. 51º
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-emerald-600">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Casos Resolvidos</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {dashboard ? dashboard.resolved : 0}
          </div>
          <span className="text-xs text-slate-400">
            Tempo médio: {dashboard?.avg_resolution_days || 0} dias
          </span>
        </GlassCard>
      </div>

      {/* Barra de Filtros e Ação */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por referência, colaborador, resumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Todos os Estados</option>
                <option value="EM_TRIAGEM">Em Triagem</option>
                <option value="EM_MEDIACAO">Em Mediação</option>
                <option value="EM_INVESTIGACAO">Em Investigação</option>
                <option value="EM_ACOMPANHAMENTO">Em Acompanhamento</option>
                <option value="RESOLVIDO">Resolvido</option>
                <option value="ENCAMINHADO_DISCIPLINAR">Encaminhado Disciplinar</option>
                <option value="ENCERRADO">Encerrado</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">Todas as Severidades</option>
                <option value="CRITICA">Crítica</option>
                <option value="ALTA">Alta</option>
                <option value="MEDIA">Média</option>
                <option value="BAIXA">Baixa</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => setShowNewCaseModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registar Ocorrência / Denúncia</span>
          </button>
        </div>
      </GlassCard>

      {/* Grid Principal: Lista à Esquerda + Detalhes à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Lista de Ocorrências (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ocorrências Registadas ({cases.length})
            </span>
            <span className="text-xs text-slate-400">Angola LGT 12/23 &amp; Lei 22/11</span>
          </div>

          {isLoadingCases ? (
            <GlassCard className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <p className="text-xs">A carregar ocorrências...</p>
            </GlassCard>
          ) : cases.length === 0 ? (
            <GlassCard className="p-8 text-center text-slate-400">
              <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum caso de conflito encontrado.</p>
              <p className="text-xs text-slate-500 mt-1">
                Utilize o botão acima para registar a primeira ocorrência.
              </p>
            </GlassCard>
          ) : (
            cases.map((c) => {
              const isSelected = c.id === activeCaseId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCaseId(c.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                      : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {c.reference_code}
                      </span>
                      {c.is_confidential && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded">
                          <Lock className="w-3 h-3" /> Confidencial
                        </span>
                      )}
                      {c.retaliation_risk && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 dark:bg-red-950/60 dark:text-red-300 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Risco Retaliação
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getSeverityBadge(
                        c.severity
                      )}`}
                    >
                      {c.severity}
                    </span>
                  </div>

                  <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                    {c.title}
                  </h4>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {c.summary}
                  </p>

                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusBadge(c.status)}`}>
                        {formatStatusLabel(c.status)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatTypeLabel(c.conflict_type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{c.meetings_count} reuniões</span>
                      <span>•</span>
                      <span>{c.actions_count} ações</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Coluna Direita: Detalhes do Caso (7 cols) */}
        <div className="lg:col-span-7">
          {isLoadingDetail ? (
            <GlassCard className="p-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
              <p className="text-xs">A carregar detalhes do caso...</p>
            </GlassCard>
          ) : !selectedCaseDetail ? (
            <GlassCard className="p-12 text-center text-slate-400">
              <Scale className="w-10 h-10 mx-auto mb-3 opacity-40 text-slate-400" />
              <p className="text-sm font-medium">Selecione uma ocorrência para visualizar a gestão do processo.</p>
              <p className="text-xs text-slate-500 mt-1">
                Mediações, atas, audições, ações corretivas e proteção contra retaliação.
              </p>
            </GlassCard>
          ) : (
            <GlassCard className="p-5 space-y-5">
              {/* Header do Caso Selecionado */}
              <div className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded">
                      {selectedCaseDetail.reference_code}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getStatusBadge(
                        selectedCaseDetail.status
                      )}`}
                    >
                      {formatStatusLabel(selectedCaseDetail.status)}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getSeverityBadge(
                        selectedCaseDetail.severity
                      )}`}
                    >
                      Gravidade: {selectedCaseDetail.severity}
                    </span>
                  </div>

                  {/* Ações Rápidas de Gestão */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setTriageForm({
                          severity: selectedCaseDetail.severity,
                          resolution_route: selectedCaseDetail.resolution_route || 'MEDIACAO',
                          assigned_mediator_name: selectedCaseDetail.assigned_mediator_name || '',
                          retaliation_risk: selectedCaseDetail.retaliation_risk,
                          urgent_protection_measures:
                            selectedCaseDetail.urgent_protection_measures || '',
                          status: selectedCaseDetail.status,
                        });
                        setShowTriageModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                    >
                      Triagem / Encaminhamento
                    </button>

                    <button
                      onClick={() => {
                        setStatusForm({
                          status: selectedCaseDetail.status,
                          closure_reason: selectedCaseDetail.closure_reason || '',
                        });
                        setShowStatusModal(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    >
                      Alterar Estado
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedCaseDetail.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>
                      <strong>Ocorrido em:</strong>{' '}
                      {new Date(selectedCaseDetail.incident_date).toLocaleDateString('pt-AO')}
                    </span>
                    <span>•</span>
                    <span>
                      <strong>Tipologia:</strong> {formatTypeLabel(selectedCaseDetail.conflict_type)}
                    </span>
                    {selectedCaseDetail.department_name && (
                      <>
                        <span>•</span>
                        <span>
                          <strong>Departamento:</strong> {selectedCaseDetail.department_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Banner de Proteção / Risco de Retaliação */}
                {selectedCaseDetail.retaliation_risk && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">
                        Medidas Cautelares de Proteção Ativas (LGT n.º 12/23 art. 51º)
                      </strong>
                      <p className="mt-0.5 text-red-700 dark:text-red-300">
                        {selectedCaseDetail.urgent_protection_measures ||
                          'Garantida a separação funcional e proibição de qualquer ato retaliatório durante a pendência do processo.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-Tabs do Caso */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar text-xs font-medium">
                <button
                  onClick={() => setActiveDetailTab('overview')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'overview'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Visão Geral &amp; Rota
                </button>
                <button
                  onClick={() => setActiveDetailTab('participants')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'participants'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Partes &amp; Testemunhas ({selectedCaseDetail.participants.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('meetings')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'meetings'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Mediação &amp; Atas ({selectedCaseDetail.meetings.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('actions')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'actions'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Ações Corretivas ({selectedCaseDetail.actions.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('followup')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'followup'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Acompanhamento Pós-Resolução ({selectedCaseDetail.follow_ups.length})
                </button>
                <button
                  onClick={() => setActiveDetailTab('audit')}
                  className={`pb-2 px-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeDetailTab === 'audit'
                      ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Auditoria Lei 22/11 ({selectedCaseDetail.audit_logs.length})
                </button>
              </div>

              {/* Sub-Tab 1: Visão Geral */}
              {activeDetailTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div>
                    <h5 className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Resumo da Ocorrência
                    </h5>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {selectedCaseDetail.summary}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        Rota de Resolução &amp; Tramitação
                      </span>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Encaminhamento:</strong>{' '}
                        {selectedCaseDetail.resolution_route || 'Mediação Voluntária'}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Mediador / Responsável:</strong>{' '}
                        {selectedCaseDetail.assigned_mediator_name || 'Aguardando designação'}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Registado em:</strong>{' '}
                        {new Date(selectedCaseDetail.reported_at).toLocaleString('pt-AO')}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-1.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                        Partes Principais Identificadas
                      </span>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Reclamante / Participante:</strong>{' '}
                        {selectedCaseDetail.complainant_name || (selectedCaseDetail.is_confidential ? 'Denúncia Anónima / Confidencial' : 'Não identificado')}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong>Parte Envolvida / Reclamado:</strong>{' '}
                        {selectedCaseDetail.respondent_name || 'Não especificado'}
                      </p>
                      {selectedCaseDetail.closure_reason && (
                        <p className="text-emerald-700 dark:text-emerald-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <strong>Conclusão / Acordo:</strong> {selectedCaseDetail.closure_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Partes & Testemunhas */}
              {activeDetailTab === 'participants' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Declarações &amp; Garantia de Imparcialidade
                    </span>
                    <button
                      onClick={() => setShowParticipantModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Adicionar Parte / Testemunha</span>
                    </button>
                  </div>

                  {selectedCaseDetail.participants.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      Nenhum participante adicionado formalmente.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCaseDetail.participants.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {p.name}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {formatRoleLabel(p.role)}
                              </span>
                            </div>

                            {p.has_conflict_of_interest ? (
                              <span className="text-[10px] font-semibold text-red-700 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded">
                                Conflito de Interesses Declarado
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded flex items-center gap-1">
                                <Check className="w-3 h-3" /> Imparcialidade Verificada
                              </span>
                            )}
                          </div>

                          {p.statement ? (
                            <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 italic">
                              "{p.statement}"
                              {p.statement_date && (
                                <span className="block not-italic text-[10px] text-slate-400 mt-1">
                                  Declaração prestada em:{' '}
                                  {new Date(p.statement_date).toLocaleString('pt-AO')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">Sem declaração formal registada.</p>
                          )}

                          {p.has_conflict_of_interest && p.conflict_of_interest_details && (
                            <p className="text-red-600 dark:text-red-400 text-[11px]">
                              <strong>Detalhe do impedimento:</strong>{' '}
                              {p.conflict_of_interest_details}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 3: Audiências & Mediação */}
              {activeDetailTab === 'meetings' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sessões de Mediação, Audições e Atas
                    </span>
                    <button
                      onClick={() => setShowMeetingModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Registar Sessão / Ata</span>
                    </button>
                  </div>

                  {selectedCaseDetail.meetings.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      Nenhuma sessão de mediação ou audição realizada até ao momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCaseDetail.meetings.map((m) => (
                        <div
                          key={m.id}
                          className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {m.meeting_type === 'JOINT_MEDIATION'
                                  ? 'Sessão Conjunta de Mediação'
                                  : m.meeting_type === 'INDIVIDUAL_HEARING'
                                  ? 'Audição Individual'
                                  : 'Sessão de Conciliação'}
                              </span>
                              <span className="text-slate-400">em {m.location}</span>
                            </div>
                            <span className="text-slate-500 font-mono">
                              {new Date(m.scheduled_at).toLocaleString('pt-AO')}
                            </span>
                          </div>

                          <div className="text-slate-600 dark:text-slate-300 space-y-1">
                            <p>
                              <strong>Conduzido por:</strong> {m.conducted_by}
                            </p>
                            {m.attendees && (
                              <p>
                                <strong>Presentes:</strong> {m.attendees}
                              </p>
                            )}
                          </div>

                          {m.minutes && (
                            <div className="mt-2 p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800">
                              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                Resumo da Ata:
                              </span>
                              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                                {m.minutes}
                              </p>
                            </div>
                          )}

                          {m.agreed_points && (
                            <div className="p-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded border border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200">
                              <span className="font-bold block mb-1 flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-600" /> Pontos de Consenso e Compromissos:
                              </span>
                              <p className="whitespace-pre-line text-[11px]">{m.agreed_points}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 4: Ações Corretivas */}
              {activeDetailTab === 'actions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Plano de Resolução &amp; Compromissos Acordados
                    </span>
                    <button
                      onClick={() => setShowActionModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Nova Ação Corretiva</span>
                    </button>
                  </div>

                  {selectedCaseDetail.actions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      Nenhuma ação corretiva atribuída a este processo.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedCaseDetail.actions.map((a) => {
                        const isDone = a.status === 'COMPLETED';
                        return (
                          <div
                            key={a.id}
                            className={`p-3 rounded-lg border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                              isDone
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold ${
                                    isDone
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {a.title}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {a.action_type}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                                {a.description}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                                <span>
                                  <strong>Responsável:</strong> {a.assigned_to}
                                </span>
                                <span>•</span>
                                <span>
                                  <strong>Prazo:</strong>{' '}
                                  {new Date(a.due_date).toLocaleDateString('pt-AO')}
                                </span>
                                {a.completion_notes && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      {a.completion_notes}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {!isDone ? (
                                <button
                                  onClick={() =>
                                    updateActionMutation.mutate({
                                      actionId: a.id,
                                      payload: {
                                        status: 'COMPLETED',
                                        completion_notes: 'Cumprimento validado pelos RH.',
                                      },
                                    })
                                  }
                                  className="px-3 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Concluir
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                                  <CheckCircle2 className="w-4 h-4" /> Concluída
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 5: Acompanhamento Pós-Resolução */}
              {activeDetailTab === 'followup' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Monitorização do Clima &amp; Deteção de Retaliação
                    </span>
                    <button
                      onClick={() => setShowFollowUpModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Novo Acompanhamento</span>
                    </button>
                  </div>

                  {selectedCaseDetail.follow_ups.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg">
                      Nenhum contacto de pós-resolução registado. Recomenda-se acompanhamento aos 30 e 60 dias.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedCaseDetail.follow_ups.map((f) => (
                        <div
                          key={f.id}
                          className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                Revisão em {new Date(f.review_date).toLocaleDateString('pt-AO')}
                              </span>
                              <span className="text-slate-400">por {f.reviewed_by}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              {f.retaliation_detected ? (
                                <span className="text-[10px] font-semibold text-red-700 bg-red-100 dark:bg-red-950/60 px-2 py-0.5 rounded">
                                  Alerta: Retaliação Detetada
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                                  Sem Retaliação
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  f.is_stable
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60'
                                }`}
                              >
                                {f.is_stable ? 'Relação Estabilizada' : 'Tensão Persistente'}
                              </span>
                            </div>
                          </div>

                          <p className="text-slate-700 dark:text-slate-300">{f.notes}</p>

                          {(f.feedback_complainant || f.feedback_respondent) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                              {f.feedback_complainant && (
                                <div className="p-2 bg-white dark:bg-slate-950 rounded">
                                  <strong>Feedback Reclamante:</strong> {f.feedback_complainant}
                                </div>
                              )}
                              {f.feedback_respondent && (
                                <div className="p-2 bg-white dark:bg-slate-950 rounded">
                                  <strong>Feedback Parte Envolvida:</strong> {f.feedback_respondent}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 6: Auditoria & Lei 22/11 */}
              {activeDetailTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Rastreabilidade Imutável (Lei de Proteção de Dados Pessoais de Angola - Lei n.º 22/11)
                    </span>
                    <span className="text-[11px] text-slate-400">Total: {selectedCaseDetail.audit_logs.length} ações</span>
                  </div>

                  <div className="space-y-2">
                    {selectedCaseDetail.audit_logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/60 rounded text-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {log.action}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500">{log.performed_by}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                            {log.details || 'Sem notas adicionais'}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {new Date(log.created_at).toLocaleString('pt-AO')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* Modal: Nova Ocorrência */}
      {showNewCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-xl w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                <span>Registar Ocorrência / Conflito Laboral</span>
              </h3>
              <button
                onClick={() => setShowNewCaseModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Título da Ocorrência *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Divergência na escala de piquetes de fim-de-semana"
                  value={newCaseForm.title}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Tipologia de Conflito</label>
                  <select
                    value={newCaseForm.conflict_type}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, conflict_type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="INTERPESSOAL">Interpessoal (Equipa)</option>
                    <option value="CONDICOES_TRABALHO">Condições de Trabalho / Horários</option>
                    <option value="ASSEDIO_MORAL">Assédio Moral (Inquérito Obrigatório)</option>
                    <option value="ASSEDIO_SEXUAL">Assédio Sexual (Urgente / LGT art. 51º)</option>
                    <option value="SALARIAL">Salarial / Enquadramento</option>
                    <option value="DISCIPLINAR">Incumprimento de Regras / Disciplinar</option>
                    <option value="OUTRO">Outro Motivo</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Severidade Inicial</label>
                  <select
                    value={newCaseForm.severity}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, severity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="BAIXA">Baixa (Tensão pontual)</option>
                    <option value="MEDIA">Média (Atrito reiterado)</option>
                    <option value="ALTA">Alta (Impacto produtivo/moral)</option>
                    <option value="CRITICA">Crítica (Violência / Assédio grave)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Departamento</label>
                  <select
                    value={newCaseForm.department_id}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, department_id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="">Geral / Sem departamento</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Data do Incidente</label>
                  <input
                    type="date"
                    value={newCaseForm.incident_date}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, incident_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                  </input>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg space-y-2 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Confidencialidade da Denúncia
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCaseForm.is_confidential}
                      onChange={(e) =>
                        setNewCaseForm({ ...newCaseForm, is_confidential: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
                <p className="text-[11px] text-slate-500">
                  Protege a identidade do denunciante nos termos da Lei de Proteção de Dados (Lei 22/11).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Reclamante / Participante</label>
                  <input
                    type="text"
                    list="conflict-employees-list"
                    placeholder="Nome do colaborador"
                    value={newCaseForm.complainant_name}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, complainant_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Parte Envolvida / Reclamado</label>
                  <input
                    type="text"
                    list="conflict-employees-list"
                    placeholder="Nome do envolvido ou chefia"
                    value={newCaseForm.respondent_name}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, respondent_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <datalist id="conflict-employees-list">
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.full_name}>
                    {emp.code} • {emp.full_name}
                  </option>
                ))}
              </datalist>

              <div>
                <label className="font-semibold block mb-1">Descrição Objetiva dos Factos *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o que ocorreu, horários, impactos na equipa..."
                  value={newCaseForm.summary}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, summary: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="retaliation_risk"
                    checked={newCaseForm.retaliation_risk}
                    onChange={(e) =>
                      setNewCaseForm({ ...newCaseForm, retaliation_risk: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="retaliation_risk" className="font-semibold text-slate-700 dark:text-slate-300">
                    Existe risco iminente de retaliação ou prejuízo laboral?
                  </label>
                </div>

                {newCaseForm.retaliation_risk && (
                  <input
                    type="text"
                    placeholder="Medidas cautelares imediatas (ex: alteração provisória de turno, mediação externa...)"
                    value={newCaseForm.urgent_protection_measures}
                    onChange={(e) =>
                      setNewCaseForm({
                        ...newCaseForm,
                        urgent_protection_measures: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewCaseModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newCaseForm.title || !newCaseForm.summary || createCaseMutation.isPending}
                onClick={() => createCaseMutation.mutate(newCaseForm)}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {createCaseMutation.isPending ? 'A registar...' : 'Registar Ocorrência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Triagem & Encaminhamento */}
      {showTriageModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <span>Triagem &amp; Encaminhamento do Caso</span>
              </h3>
              <button
                onClick={() => setShowTriageModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Rota de Resolução Adequada</label>
                <select
                  value={triageForm.resolution_route}
                  onChange={(e) => setTriageForm({ ...triageForm, resolution_route: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="MEDIACAO">Mediação Voluntária (Consenso entre as partes)</option>
                  <option value="CONCILIACAO_DIRETA">Conciliação com Chefia Direta</option>
                  <option value="INVESTIGACAO_DISCIPLINAR">Investigação / Inquérito Disciplinar (LGT 12/23)</option>
                  <option value="ENCAMINHAMENTO_JURIDICO">Encaminhamento Jurídico / Contencioso</option>
                  <option value="ARQUIVAMENTO">Arquivamento por Inconsistência de Factos</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Classificação de Gravidade</label>
                  <select
                    value={triageForm.severity}
                    onChange={(e) => setTriageForm({ ...triageForm, severity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="MEDIA">Média</option>
                    <option value="ALTA">Alta</option>
                    <option value="CRITICA">Crítica</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Estado do Processo</label>
                  <select
                    value={triageForm.status}
                    onChange={(e) => setTriageForm({ ...triageForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="EM_MEDIACAO">Em Mediação</option>
                    <option value="EM_INVESTIGACAO">Em Investigação</option>
                    <option value="EM_ACOMPANHAMENTO">Em Acompanhamento</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Mediador(a) / Técnico Designado</label>
                <input
                  type="text"
                  placeholder="Ex: Dra. Elsa Gaspar (Técnica Sénior de RH)"
                  value={triageForm.assigned_mediator_name}
                  onChange={(e) =>
                    setTriageForm({ ...triageForm, assigned_mediator_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="triage_retaliation"
                    checked={triageForm.retaliation_risk}
                    onChange={(e) =>
                      setTriageForm({ ...triageForm, retaliation_risk: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="triage_retaliation" className="font-semibold text-slate-700 dark:text-slate-300">
                    Sinalizar Proteção Contra Retaliação (LGT art. 51º)
                  </label>
                </div>

                {triageForm.retaliation_risk && (
                  <textarea
                    rows={2}
                    placeholder="Descreva as medidas de proteção aplicadas pelo departamento de RH..."
                    value={triageForm.urgent_protection_measures}
                    onChange={(e) =>
                      setTriageForm({
                        ...triageForm,
                        urgent_protection_measures: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTriageModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={triageMutation.isPending}
                onClick={() =>
                  triageMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: triageForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {triageMutation.isPending ? 'A atualizar...' : 'Confirmar Triagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alterar Estado / Encerrar */}
      {showStatusModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Transição de Estado do Caso</span>
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Novo Estado</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="EM_MEDIACAO">Em Mediação</option>
                  <option value="EM_INVESTIGACAO">Em Investigação</option>
                  <option value="EM_ACOMPANHAMENTO">Em Acompanhamento Pós-Acordo</option>
                  <option value="RESOLVIDO">Resolvido (Consenso e Acordo Cumprido)</option>
                  <option value="ENCAMINHADO_DISCIPLINAR">Encaminhado para Ação Disciplinar</option>
                  <option value="ENCERRADO">Encerrado sem Acordo</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Motivo / Fundamentação do Fecho</label>
                <textarea
                  rows={3}
                  placeholder="Descreva as conclusões do processo, compromissos assumidos ou fundamentação..."
                  value={statusForm.closure_reason}
                  onChange={(e) => setStatusForm({ ...statusForm, closure_reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() =>
                  updateStatusMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: statusForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {updateStatusMutation.isPending ? 'A atualizar...' : 'Atualizar Estado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Participante */}
      {showParticipantModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                <span>Adicionar Parte / Testemunha</span>
              </h3>
              <button
                onClick={() => setShowParticipantModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome do colaborador ou testemunha"
                  value={participantForm.name}
                  onChange={(e) => setParticipantForm({ ...participantForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Papel no Processo</label>
                <select
                  value={participantForm.role}
                  onChange={(e) => setParticipantForm({ ...participantForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="WITNESS">Testemunha</option>
                  <option value="COMPLAINANT">Reclamante / Participante</option>
                  <option value="RESPONDENT">Parte Envolvida / Reclamado</option>
                  <option value="DEPARTMENT_HEAD">Chefia Direta</option>
                  <option value="MEDIATOR">Mediador(a) / Co-mediador(a)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Declaração Inicial / Depoimento</label>
                <textarea
                  rows={3}
                  placeholder="Declarações prestadas ou factos relatados pela testemunha..."
                  value={participantForm.statement}
                  onChange={(e) =>
                    setParticipantForm({ ...participantForm, statement: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="part_conflict_interest"
                    checked={participantForm.has_conflict_of_interest}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        has_conflict_of_interest: e.target.checked,
                      })
                    }
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <label
                    htmlFor="part_conflict_interest"
                    className="font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Identificado Conflito de Interesses ou Parentesco?
                  </label>
                </div>

                {participantForm.has_conflict_of_interest && (
                  <input
                    type="text"
                    placeholder="Indique a natureza da relação ou impedimento"
                    value={participantForm.conflict_of_interest_details}
                    onChange={(e) =>
                      setParticipantForm({
                        ...participantForm,
                        conflict_of_interest_details: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowParticipantModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!participantForm.name || addParticipantMutation.isPending}
                onClick={() =>
                  addParticipantMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: participantForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {addParticipantMutation.isPending ? 'A adicionar...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registar Reunião / Mediação */}
      {showMeetingModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span>Registar Sessão de Mediação / Audição</span>
              </h3>
              <button
                onClick={() => setShowMeetingModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Tipo de Sessão</label>
                  <select
                    value={meetingForm.meeting_type}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meeting_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="JOINT_MEDIATION">Sessão Conjunta de Mediação</option>
                    <option value="INDIVIDUAL_HEARING">Audição Individual Prévia</option>
                    <option value="CONCILIATION_SESSION">Sessão de Conciliação</option>
                    <option value="PRELIMINARY_INTERVIEW">Entrevista Preliminar</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Data e Hora</label>
                  <input
                    type="datetime-local"
                    value={meetingForm.scheduled_at}
                    onChange={(e) => setMeetingForm({ ...meetingForm, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Conduzido Por *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do mediador / instrutor"
                    value={meetingForm.conducted_by}
                    onChange={(e) => setMeetingForm({ ...meetingForm, conducted_by: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Local / Gabinete</label>
                  <input
                    type="text"
                    value={meetingForm.location}
                    onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Participantes Presentes</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Fernando, Manuel Domingos, Dra. Elsa Gaspar"
                  value={meetingForm.attendees}
                  onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Resumo da Ata / Ocorrido na Sessão</label>
                <textarea
                  rows={3}
                  placeholder="Pontos abordados, atitude das partes, esclarecimentos prestados..."
                  value={meetingForm.minutes}
                  onChange={(e) => setMeetingForm({ ...meetingForm, minutes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Pontos de Acordo e Compromissos Assumidos</label>
                <textarea
                  rows={2}
                  placeholder="1. Alteração de turnos quinzenais; 2. Compromisso de comunicação prévia..."
                  value={meetingForm.agreed_points}
                  onChange={(e) => setMeetingForm({ ...meetingForm, agreed_points: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowMeetingModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!meetingForm.conducted_by || createMeetingMutation.isPending}
                onClick={() =>
                  createMeetingMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: meetingForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {createMeetingMutation.isPending ? 'A registar...' : 'Gravar Sessão e Ata'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Ação Corretiva */}
      {showActionModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                <span>Nova Ação Corretiva</span>
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Título da Ação *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Realização de formação em inteligência emocional"
                  value={actionForm.title}
                  onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Tipo de Ação</label>
                <select
                  value={actionForm.action_type}
                  onChange={(e) => setActionForm({ ...actionForm, action_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                >
                  <option value="COMPROMISSO_CONDUTA">Compromisso Mútuo de Conduta</option>
                  <option value="FORMACAO_SENSIBILIZACAO">Formação / Sensibilização de Liderança</option>
                  <option value="AJUSTE_CARGA">Ajuste de Escala / Carga Horária</option>
                  <option value="MUDANCA_EQUIPA">Transferência Voluntária de Equipa</option>
                  <option value="MELHORIA_PROCESSO">Melhoria de Processo Operacional</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Descrição Detalhada</label>
                <textarea
                  rows={2}
                  placeholder="Passos concretos a executar para cumprimento da ação..."
                  value={actionForm.description}
                  onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Responsável *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do colaborador ou chefia"
                    value={actionForm.assigned_to}
                    onChange={(e) => setActionForm({ ...actionForm, assigned_to: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Data-Limite</label>
                  <input
                    type="date"
                    value={actionForm.due_date}
                    onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowActionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!actionForm.title || !actionForm.assigned_to || createActionMutation.isPending}
                onClick={() =>
                  createActionMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: actionForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {createActionMutation.isPending ? 'A registar...' : 'Criar Ação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo Acompanhamento Pós-Resolução */}
      {showFollowUpModal && selectedCaseDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Registo de Acompanhamento Pós-Resolução</span>
              </h3>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Data da Revisão</label>
                  <input
                    type="date"
                    value={followUpForm.review_date}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, review_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Técnico Responsável *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome do técnico de RH"
                    value={followUpForm.reviewed_by}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, reviewed_by: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Notas do Acompanhamento *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Avaliação global do ambiente e relacionamento laboral..."
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Feedback Reclamante</label>
                  <input
                    type="text"
                    placeholder="Comentário da parte"
                    value={followUpForm.feedback_complainant}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, feedback_complainant: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Feedback Parte Envolvida</label>
                  <input
                    type="text"
                    placeholder="Comentário da parte"
                    value={followUpForm.feedback_respondent}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, feedback_respondent: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fol_stable"
                    checked={followUpForm.is_stable}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, is_stable: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="fol_stable" className="font-semibold text-slate-700 dark:text-slate-300">
                    O relacionamento laboral mantém-se estável e normalizado?
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="fol_retaliation"
                    checked={followUpForm.retaliation_detected}
                    onChange={(e) =>
                      setFollowUpForm({ ...followUpForm, retaliation_detected: e.target.checked })
                    }
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="fol_retaliation" className="font-semibold text-red-700 dark:text-red-300">
                    Foi detetado algum indício de represália ou retaliação?
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!followUpForm.reviewed_by || !followUpForm.notes || createFollowUpMutation.isPending}
                onClick={() =>
                  createFollowUpMutation.mutate({
                    id: selectedCaseDetail.id,
                    payload: followUpForm,
                  })
                }
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {createFollowUpMutation.isPending ? 'A registar...' : 'Gravar Acompanhamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
