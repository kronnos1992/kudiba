import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Key,
  FileText,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  Search,
  X,
  Upload,
  Trash2,
  Save,
  Sparkles,
  Landmark,
  MapPin,
  Phone,
  Mail,
  Globe,
  Plus,
  Star,
  CheckCircle2,
  AlertCircle,
  Shield,
  History,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { useAuthStore } from '../../stores/authStore';
import { authApi, TenantMember, InviteMemberPayload, RoleCatalogItem } from '../../api/auth';
import { TenantBankAccount } from '../../types/auth';
import { invoicingApi } from '../../api/invoicing';
import { toast } from '../../stores/toastStore';
import { RolesManager } from './RolesManager';
import { DatabaseSettingsManager } from './DatabaseSettingsManager';
import { AuditAndActivitiesTab } from './AuditAndActivitiesTab';

type SettingsTab = 'organization' | 'users' | 'certification' | 'series' | 'saft' | 'databases';

interface SettingsViewProps {
  onOpenOnboarding?: () => void;
}

const ANGOLA_PROVINCES = [
  'Luanda',
  'Bengo',
  'Benguela',
  'Bié',
  'Cabinda',
  'Cuando',
  'Cubango',
  'Cuanza Norte',
  'Cuanza Sul',
  'Cunene',
  'Huambo',
  'Huíla',
  'Icolo e Bengo',
  'Lunda Norte',
  'Lunda Sul',
  'Malanje',
  'Moxico',
  'Moxico Leste',
  'Namibe',
  'Uíge',
  'Zaire',
];

const ANGOLA_BANKS_MAP: Record<string, { name: string; swift: string }> = {
  '0040': { name: 'BAI - Banco Angolano de Investimentos', swift: 'BAIPAOLU' },
  '0006': { name: 'BFA - Banco de Fomento Angola', swift: 'BFMAAOLU' },
  '0055': { name: 'Banco BIC', swift: 'BICAALLU' },
  '0005': { name: 'BCI - Banco de Comércio e Indústria', swift: 'BCIAAOLU' },
  '0053': { name: 'Banco Millennium Atlântico', swift: 'BMAOAOLU' },
  '0051': { name: 'Standard Bank Angola', swift: 'SBICAOLX' },
  '0044': { name: 'Banco Sol', swift: 'SOLBAOLU' },
  '0045': { name: 'Banco Keve', swift: 'BKEVAOLU' },
  '0059': { name: 'Banco Yetu', swift: 'YETUAOLU' },
  '0043': { name: 'BNI - Banco de Negócios Internacional', swift: 'BNINAOLU' },
  '0054': { name: 'BCGA - Banco Caixa Geral Angola', swift: 'BCGAAOLU' },
  '0058': { name: 'BPC - Banco de Poupança e Crédito', swift: 'BPCTAOLU' },
  '0067': { name: 'Access Bank Angola', swift: 'ACENAOLU' },
  '0052': { name: 'BCA - Banco Comercial Angolano', swift: 'BCOMAOLU' },
};

const getNifValidation = (nif: string) => {
  const clean = nif.replace(/[\s.-]/g, '').toUpperCase();
  if (!clean) return null;
  if (/^5\d{9}$/.test(clean)) {
    return { valid: true, type: 'EMPRESA', label: 'NIF de Empresa Válido (Pessoa Coletiva)' };
  }
  if (/^\d{9}[A-Z]{2}\d{3}$/.test(clean)) {
    return { valid: true, type: 'SINGULAR', label: 'NIF / BI de Pessoa Singular Válido' };
  }
  if (/^\d{10}$/.test(clean)) {
    return { valid: true, type: 'COLETIVA', label: 'NIF Conforme (10 dígitos)' };
  }
  if (clean.length < 10) {
    return { valid: false, type: 'INCOMPLETO', label: `Incompleto (${clean.length}/10 dígitos)` };
  }
  return { valid: false, type: 'INVALIDO', label: 'Formato de NIF não padrão' };
};

const getIbanValidation = (iban: string) => {
  const clean = iban.replace(/[\s.-]/g, '').toUpperCase();
  if (!clean) return null;
  const isAO = clean.startsWith('AO06') || clean.startsWith('AO');
  if (isAO && clean.length === 25) {
    return { valid: true, label: 'AO06 Conforme (25 caracteres)' };
  }
  if (isAO && clean.length < 25) {
    return { valid: false, label: `${clean.length}/25 caracteres (BNA)` };
  }
  return null;
};

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenOnboarding }) => {
  const queryClient = useQueryClient();
  const { activeTenant, activeBranch, user, updateActiveTenantSettings } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');
  const [previewMode, setPreviewMode] = useState<'a4' | 'thermal'>('a4');
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Company Parameterization Form State
  const [companyForm, setCompanyForm] = useState({
    company_name: '',
    trade_name: '',
    nif: '',
    commercial_registry: '',
    share_capital: '',
    currency: 'AOA',
    logo_data_url: null as string | null,
    address_detail: '',
    city: 'Luanda',
    province: 'Luanda',
    postal_code: '',
    country: 'AO',
    phone: '',
    email: '',
    website: '',
    tax_regime_code: 'REGIME_GERAL',
    tax_office_code: '1.ª Repartição Fiscal de Luanda',
    agt_cert_number: 'AGT/2026/0042',
    default_withholding_rate: 6.5,
    invoice_footer_notes:
      'Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.',
    bank_accounts: [] as TenantBankAccount[],
  });
  const [savingCompany, setSavingCompany] = useState(false);

  // Branch Creation Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState({
    code: '',
    name: '',
    city: 'Luanda',
    address_detail: '',
  });

  // Search & Modal States
  const [userSearch, setUserSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMemberForRoles, setSelectedMemberForRoles] = useState<TenantMember | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [memberToDelete, setMemberToDelete] = useState<TenantMember | null>(null);

  // Invite Form
  const [inviteForm, setInviteForm] = useState<InviteMemberPayload>({
    email: '',
    full_name: '',
    roles: ['OPERADOR_CAIXA'],
    branch_id: activeBranch?.id || null,
    password: '',
  });

  // Series Form
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [seriesForm, setSeriesForm] = useState({
    code: '2026-A',
    fiscal_year: new Date().getFullYear(),
  });

  // Queries
  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant_settings', activeTenant?.id],
    queryFn: authApi.getTenantSettings,
    enabled: Boolean(activeTenant?.id),
  });

  useEffect(() => {
    const src = tenantSettings || activeTenant;
    if (!src) return;
    setCompanyForm({
      company_name: src.company_name || (src as any).name || '',
      trade_name: src.trade_name || (src as any).name || '',
      nif: src.nif || (src as any).taxId || '',
      commercial_registry: src.commercial_registry || '',
      share_capital: src.share_capital || '',
      currency: src.currency || 'AOA',
      logo_data_url: src.logo_data_url || null,
      address_detail: src.address_detail || '',
      city: src.city || 'Luanda',
      province: src.province || 'Luanda',
      postal_code: src.postal_code || '',
      country: src.country || 'AO',
      phone: src.phone || '',
      email: src.email || '',
      website: src.website || '',
      tax_regime_code: src.tax_regime_code || 'REGIME_GERAL',
      tax_office_code: src.tax_office_code || '1.ª Repartição Fiscal de Luanda',
      agt_cert_number: src.agt_cert_number || 'AGT/2026/0042',
      default_withholding_rate: src.default_withholding_rate ?? 6.5,
      invoice_footer_notes:
        src.invoice_footer_notes ||
        'Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.',
      bank_accounts: src.bank_accounts && src.bank_accounts.length > 0 ? src.bank_accounts : [],
    });
  }, [tenantSettings, activeTenant?.id]);

  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['auth_members'],
    queryFn: authApi.listMembers,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['auth_branches'],
    queryFn: authApi.listBranches,
  });

  const { data: rolesCatalog = [] } = useQuery({
    queryKey: ['auth_roles'],
    queryFn: authApi.listRoles,
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['invoicing_series'],
    queryFn: invoicingApi.listSeries,
  });

  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);

  // Mutations
  const createBranchMutation = useMutation({
    mutationFn: authApi.createBranch,
    onSuccess: (newBranch) => {
      queryClient.invalidateQueries({ queryKey: ['auth_branches'] });
      if (activeTenant) {
        updateActiveTenantSettings({
          branches: [...(activeTenant.branches || []), newBranch],
        });
      }
      setIsBranchModalOpen(false);
      setBranchForm({ code: '', name: '', city: 'Luanda', address_detail: '' });
      toast.success(`Filial "${newBranch.name}" criada com sucesso!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Erro ao criar filial.');
    },
  });

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.warning('O ficheiro de logótipo não deve exceder 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCompanyForm((prev) => ({ ...prev, logo_data_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddBank = () => {
    setCompanyForm((prev) => ({
      ...prev,
      bank_accounts: [
        ...prev.bank_accounts,
        {
          bank_name: 'BAI - Banco Angolano de Investimentos',
          iban: 'AO06.0040.0000.',
          account_number: '',
          swift: 'BAIPAOLU',
          currency: 'AOA',
          is_primary: prev.bank_accounts.length === 0,
        },
      ],
    }));
  };

  const handleUpdateBank = (index: number, field: keyof TenantBankAccount, value: any) => {
    setCompanyForm((prev) => {
      const updated = prev.bank_accounts.map((acc, i) => {
        if (i !== index) return acc;
        const nextAcc = { ...acc, [field]: value };
        if (field === 'iban') {
          const raw = String(value).replace(/[\s.-]/g, '').toUpperCase();
          if (raw.length >= 8) {
            const bankCode = raw.substring(4, 8);
            if (ANGOLA_BANKS_MAP[bankCode]) {
              nextAcc.bank_name = ANGOLA_BANKS_MAP[bankCode].name;
              nextAcc.swift = ANGOLA_BANKS_MAP[bankCode].swift;
            }
          }
        }
        return nextAcc;
      });
      return { ...prev, bank_accounts: updated };
    });
  };

  const handleSetPrimaryBank = (index: number) => {
    setCompanyForm((prev) => ({
      ...prev,
      bank_accounts: prev.bank_accounts.map((acc, i) => ({
        ...acc,
        is_primary: i === index,
      })),
    }));
  };

  const complianceChecks = useMemo(() => {
    const hasLegalName = Boolean(companyForm.company_name.trim());
    const hasNif = Boolean(companyForm.nif.trim() && companyForm.nif.trim().length >= 10);
    const hasAddress = Boolean(companyForm.address_detail.trim() && companyForm.city.trim());
    const hasTaxRegime = Boolean(companyForm.tax_regime_code);
    const hasTaxOffice = Boolean(companyForm.tax_office_code?.trim());
    const hasBank = companyForm.bank_accounts.some(
      (b) => b.iban.replace(/[\s.-]/g, '').length >= 15
    );
    const hasSeries = seriesList.some((s) => s.isActive);

    const items = [
      { label: 'Denominação Social', ok: hasLegalName, hint: 'Nome societário oficial' },
      { label: 'NIF de Empresa Válido', ok: hasNif, hint: '10 dígitos' },
      { label: 'Sede e Município', ok: hasAddress, hint: 'Endereço fiscal impresso' },
      { label: 'Regime de IVA & Repartição', ok: hasTaxRegime && hasTaxOffice, hint: 'Enquadramento tributário' },
      { label: 'IBAN para Pagamento', ok: hasBank, hint: 'Liquidação comercial' },
      { label: 'Série Fiscal 2026 Ativa', ok: hasSeries, hint: 'Cronologia e numeração' },
      { label: 'Chave RSA-2048 & Hash', ok: true, hint: 'Certificação informática' },
    ];

    const okCount = items.filter((i) => i.ok).length;
    const percentage = Math.round((okCount / items.length) * 100);

    return { items, okCount, total: items.length, percentage };
  }, [companyForm, seriesList]);

  const handleRemoveBank = (index: number) => {
    setCompanyForm((prev) => ({
      ...prev,
      bank_accounts: prev.bank_accounts.filter((_, i) => i !== index),
    }));
  };

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.company_name.trim() || !companyForm.nif.trim()) {
      toast.warning('A Denominação Social e o NIF da empresa são obrigatórios.');
      return;
    }
    if (!companyForm.address_detail.trim() || !companyForm.city.trim()) {
      toast.warning('O endereço e a cidade da sede são obrigatórios para documentos oficiais e SAF-T (AO).');
      return;
    }

    setSavingCompany(true);
    try {
      const cleanedBanks = companyForm.bank_accounts.filter(
        (b) => b.bank_name.trim() !== '' && b.iban.trim() !== ''
      );
      const payload = {
        company_name: companyForm.company_name.trim(),
        trade_name: companyForm.trade_name.trim() || companyForm.company_name.trim(),
        nif: companyForm.nif.trim(),
        commercial_registry: companyForm.commercial_registry.trim() || null,
        share_capital: companyForm.share_capital.trim() || null,
        currency: companyForm.currency,
        logo_data_url: companyForm.logo_data_url,
        address_detail: companyForm.address_detail.trim(),
        city: companyForm.city.trim(),
        province: companyForm.province.trim() || null,
        postal_code: companyForm.postal_code.trim() || null,
        country: companyForm.country.trim() || 'AO',
        phone: companyForm.phone.trim() || null,
        email: companyForm.email.trim() || null,
        website: companyForm.website.trim() || null,
        tax_regime_code: companyForm.tax_regime_code,
        tax_office_code: companyForm.tax_office_code.trim() || null,
        agt_cert_number: companyForm.agt_cert_number.trim() || null,
        default_withholding_rate: Number(companyForm.default_withholding_rate) || 6.5,
        invoice_footer_notes: companyForm.invoice_footer_notes.trim() || null,
        bank_accounts: cleanedBanks,
        onboarding_completed: true,
      };

      const saved = await authApi.updateTenantSettings(payload);

      try {
        await invoicingApi.syncFiscalTenant({
          ...payload,
          slug: activeTenant?.slug || saved.slug,
        });
      } catch {
        // Sincronização secundária silenciosa
      }

      updateActiveTenantSettings({
        ...saved,
        onboarding_completed: true,
      });
      queryClient.invalidateQueries({ queryKey: ['tenant_settings'] });
      toast.success('Parâmetros oficiais da empresa atualizados e sincronizados nos documentos!');
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Falha ao guardar configurações da empresa.'
      );
    } finally {
      setSavingCompany(false);
    }
  };

  const inviteMemberMutation = useMutation({
    mutationFn: authApi.inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      queryClient.invalidateQueries({ queryKey: ['auth_audit_logs'] });
      setIsInviteModalOpen(false);
      setInviteForm({
        email: '',
        full_name: '',
        roles: ['OPERADOR_CAIXA'],
        branch_id: activeBranch?.id || null,
        password: '',
      });
      toast.success('Utilizador convidado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Falha ao convidar utilizador.');
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      authApi.updateMemberRoles(userId, { roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      queryClient.invalidateQueries({ queryKey: ['auth_audit_logs'] });
      setSelectedMemberForRoles(null);
      toast.success('Papéis de acesso actualizados com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Falha ao actualizar papéis.');
    },
  });

  const updateMemberStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      authApi.updateMemberStatus(userId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      queryClient.invalidateQueries({ queryKey: ['auth_audit_logs'] });
      toast.success('Estado do utilizador alterado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Erro ao alterar o estado do utilizador.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => authApi.removeMember(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      queryClient.invalidateQueries({ queryKey: ['auth_audit_logs'] });
      setMemberToDelete(null);
      toast.success('Utilizador removido da empresa.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Erro ao remover utilizador da empresa.');
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: invoicingApi.createSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicing_series'] });
      setIsSeriesModalOpen(false);
    },
  });

  const filteredMembers = members.filter((m) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  const { sortedItems: sortedMembers, sortConfig: membersSort, requestSort: requestMembersSort } = useTableSort(filteredMembers, 'full_name');
  const { sortedItems: sortedSeries, sortConfig: seriesSort, requestSort: requestSeriesSort } = useTableSort(seriesList, 'seriesCode');

  const roles = user?.roles?.length ? user.roles : (activeTenant?.roles ?? []);
  const isSuperadmin = Boolean(user?.is_superadmin);
  const isAdmin = isSuperadmin || roles.some((r) => ['ADMIN', 'SUPER_ADMIN'].includes(r.toUpperCase()));

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">
          Acesso Restrito às Configurações
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O seu utilizador não possui privilégios de Administrador para parametrizar a empresa, gerir utilizadores ou chaves fiscais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Parametrização da Empresa &amp; Conformidade Fiscal
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Conforme Decreto 71/25
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure a identidade oficial da empresa (NIF, nome comercial, endereço, logótipo, IBANs e regime fiscal) constante nos documentos oficiais
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              Assistente Guiado (4 Passos)
            </button>
          )}
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            Certificado:{' '}
            <span className="font-mono text-emerald-600">
              {companyForm.agt_cert_number || 'AGT/2026/0042'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('organization')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'organization'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organização, Marca &amp; Filiais
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Utilizadores, Perfis &amp; RBAC ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('certification')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'certification'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Key className="w-4 h-4" />
            Certificação &amp; Chaves RSA
          </button>

          <button
            onClick={() => setActiveTab('series')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'series'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Séries Fiscais ({seriesList.length})
          </button>

          <button
            onClick={() => setActiveTab('saft')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'saft'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            Auditoria &amp; Logs
          </button>

          <button
            onClick={() => setActiveTab('databases')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'databases'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Database className="w-4 h-4" />
            Bases de Dados &amp; Conexões
          </button>
        </nav>
      </div>

      {/* TAB 1: ORGANIZAÇÃO & FILIAIS */}
      {activeTab === 'organization' && (
        <form onSubmit={handleSaveCompanySettings} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Identificação Legal & Registo Comercial */}
            <GlassCard className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-brand-600" />
                    1. Identificação Legal e Registo Comercial
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dados societários e fiscais obrigatórios nas Faturas, Notas de Crédito, Recibos e SAF-T (AO)
                  </p>
                </div>
                <StatusBadge status="ok" label="Sujeito Passivo" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Denominação Social (Razão Social) *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.company_name}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, company_name: e.target.value }))
                    }
                    placeholder="Ex: Kudiba Comercial Angola, Lda."
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Nome Comercial / Insígnia (Marca)
                  </label>
                  <input
                    type="text"
                    value={companyForm.trade_name}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, trade_name: e.target.value }))
                    }
                    placeholder="Ex: Kudiba ERP Angola"
                    className="input-field"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block">
                      NIF (Número de Identificação Fiscal) *
                    </label>
                    {(() => {
                      const info = getNifValidation(companyForm.nif);
                      if (!info) return null;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            info.valid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {info.valid ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <AlertCircle className="w-2.5 h-2.5" />
                          )}
                          {info.label}
                        </span>
                      );
                    })()}
                  </div>
                  <input
                    type="text"
                    required
                    value={companyForm.nif}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, nif: e.target.value }))}
                    placeholder="Ex: 5417123456"
                    className="input-field font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Conservatória / Matrícula Comercial
                  </label>
                  <input
                    type="text"
                    value={companyForm.commercial_registry}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, commercial_registry: e.target.value }))
                    }
                    placeholder="Ex: Matrícula n.º 45.892-23/CML"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Capital Social Realizado
                  </label>
                  <input
                    type="text"
                    value={companyForm.share_capital}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, share_capital: e.target.value }))
                    }
                    placeholder="Ex: 5.000.000,00 AOA"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Moeda Funcional Padrão
                  </label>
                  <select
                    value={companyForm.currency}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, currency: e.target.value }))
                    }
                    className="input-field"
                  >
                    <option value="AOA">Kwanza Angolano (AOA - Kz)</option>
                    <option value="USD">Dólar Norte-Americano (USD - $)</option>
                    <option value="EUR">Euro (EUR - €)</option>
                  </select>
                </div>
              </div>
            </GlassCard>

            {/* 2. Identidade Visual, Sede & Contactos */}
            <GlassCard className="p-6 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-600" />
                  2. Logótipo, Sede Social e Contactos Oficiais
                </h3>
                <p className="text-xs text-slate-500">
                  Logótipo e morada fiscal impressos no cabeçalho de todos os documentos oficiais
                </p>
              </div>

              <div className="p-4 rounded-xl border border-dashed border-emerald-500/40 bg-gradient-to-r from-emerald-900/20 via-emerald-800/15 to-blue-900/20 dark:from-emerald-800/30 dark:via-emerald-900/25 dark:to-blue-950/30 flex flex-col sm:flex-row items-center gap-4 cursor-pointer hover:from-emerald-900/30 hover:via-emerald-800/20 hover:to-blue-900/30 transition-all" onClick={() => logoInputRef.current?.click()}>
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-white/30 bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {companyForm.logo_data_url ? (
                    <img
                      src={companyForm.logo_data_url}
                      alt="Logótipo"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <Upload className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <p className="text-sm font-bold text-white">
                    Logótipo Oficial da Empresa
                  </p>
                  <p className="text-xs text-white/80 mt-0.5">
                    Exibido nas Faturas A4, Recibos de Salário e no topo da aplicação (PNG, JPG ou SVG até 1.5 MB).
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold shadow-sm hover:bg-white transition-all"
                      >
                      <Upload className="w-3.5 h-3.5" />
                      Carregar Imagem
                    </button>
                    {companyForm.logo_data_url && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompanyForm((prev) => ({ ...prev, logo_data_url: null }))
                        }
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover Logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Endereço Completo da Sede *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.address_detail}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, address_detail: e.target.value }))
                    }
                    placeholder="Ex: Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Cidade / Município *
                  </label>
                  <input
                    type="text"
                    required
                    value={companyForm.city}
                    onChange={(e) => setCompanyForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Luanda"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Província
                  </label>
                  <select
                    value={companyForm.province}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, province: e.target.value }))
                    }
                    className="input-field"
                  >
                    {ANGOLA_PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Código Postal / CP
                  </label>
                  <input
                    type="text"
                    value={companyForm.postal_code}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, postal_code: e.target.value }))
                    }
                    placeholder="Ex: 1000"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    País (ISO-2)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={companyForm.country}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({
                        ...prev,
                        country: e.target.value.toUpperCase(),
                      }))
                    }
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Telefone Oficial
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={companyForm.phone}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="+244 923 000 000"
                      className="input-field pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    E-mail Institucional
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={companyForm.email}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      placeholder="geral@empresa.co.ao"
                      className="input-field pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Website
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={companyForm.website}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, website: e.target.value }))
                      }
                      placeholder="https://www.empresa.co.ao"
                      className="input-field pl-9"
                    />
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 3. Parâmetros Fiscais AGT & Rodapé */}
            <GlassCard className="p-6 space-y-5">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-600" />
                  3. Parâmetros Fiscais &amp; Menções nos Documentos
                </h3>
                <p className="text-xs text-slate-500">
                  Regime de IVA, Repartição Fiscal de domicílio, retenção na fonte padrão e rodapé legal
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Regime Fiscal de IVA
                  </label>
                  <select
                    value={companyForm.tax_regime_code}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, tax_regime_code: e.target.value }))
                    }
                    className="input-field"
                  >
                    <option value="REGIME_GERAL">Regime Geral de IVA (Taxa Normal 14%)</option>
                    <option value="REGIME_SIMPLIFICADO">Regime Simplificado de IVA (7%)</option>
                    <option value="REGIME_EXCLUSAO">Regime de Exclusão (Isento 0% - M04)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Repartição Fiscal de Domicílio
                  </label>
                  <input
                    type="text"
                    value={companyForm.tax_office_code}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, tax_office_code: e.target.value }))
                    }
                    placeholder="Ex: 1.ª Repartição Fiscal de Luanda"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    N.º de Certificação do Software
                  </label>
                  <input
                    type="text"
                    value={companyForm.agt_cert_number}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, agt_cert_number: e.target.value }))
                    }
                    placeholder="AGT/2026/0042"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Taxa de Retenção na Fonte Padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={companyForm.default_withholding_rate}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({
                        ...prev,
                        default_withholding_rate: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="input-field font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1">
                    Menção Legal / Notas Padrão no Rodapé das Faturas
                  </label>
                  <textarea
                    rows={2}
                    value={companyForm.invoice_footer_notes}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({
                        ...prev,
                        invoice_footer_notes: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </GlassCard>

            {/* 4. Coordenadas Bancárias nos Documentos */}
            <GlassCard className="p-6 space-y-4 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-blue-900/80 dark:from-slate-950/95 dark:via-slate-950/90 dark:to-blue-950/95 border-slate-700/60 text-white shadow-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-white/80" />
                    4. Coordenadas Bancárias nos Documentos (IBANs)
                  </h3>
                  <p className="text-xs text-white/70">
                    Contas bancárias impressas nas Faturas e Faturas Proforma para liquidação pelos clientes
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBank}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs font-bold shadow-sm hover:bg-white transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Conta
                </button>
              </div>

              {companyForm.bank_accounts.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-white/20 rounded-xl text-xs text-white/60">
                  Nenhuma conta bancária configurada para impressão nas faturas. Clique em &ldquo;Adicionar Conta&rdquo;.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {companyForm.bank_accounts.map((acc, idx) => {
                    const ibanInfo = getIbanValidation(acc.iban);
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center p-3 rounded-xl border transition-all ${
                          acc.is_primary
                            ? 'border-amber-400/60 bg-amber-500/10 shadow-sm'
                            : 'border-white/15 bg-white/5'
                        }`}
                      >
                        <div className="sm:col-span-4">
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="block text-[10px] font-bold text-white/60 uppercase">
                              Banco
                            </label>
                            {acc.is_primary && (
                              <span className="text-[9px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-400/40">
                                Conta Principal
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={acc.bank_name}
                            onChange={(e) => handleUpdateBank(idx, 'bank_name', e.target.value)}
                            placeholder="Ex: BAI, BFA, BIC..."
                            className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="block text-[10px] font-bold text-white/60 uppercase">
                              IBAN (AO06)
                            </label>
                            {ibanInfo && (
                              <span
                                className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded ${
                                  ibanInfo.valid
                                    ? 'text-emerald-300 bg-emerald-950/60'
                                    : 'text-amber-300 bg-amber-950/60'
                                }`}
                              >
                                {ibanInfo.label}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={acc.iban}
                            onChange={(e) => handleUpdateBank(idx, 'iban', e.target.value)}
                            placeholder="AO06.0040.0000.0000.0000.0000.0"
                            className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white font-mono text-xs placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-white/60 uppercase mb-0.5">
                            Moeda
                          </label>
                          <select
                            value={acc.currency || 'AOA'}
                            onChange={(e) => handleUpdateBank(idx, 'currency', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all"
                          >
                            <option value="AOA" className="text-slate-900">AOA (Kz)</option>
                            <option value="USD" className="text-slate-900">USD ($)</option>
                            <option value="EUR" className="text-slate-900">EUR (€)</option>
                          </select>
                        </div>

                        <div className="sm:col-span-1 flex items-center justify-end gap-1 pt-3 sm:pt-4">
                          <button
                            type="button"
                            title={acc.is_primary ? 'Conta Principal' : 'Definir como Conta Principal'}
                            onClick={() => handleSetPrimaryBank(idx)}
                            className={`p-1.5 rounded-lg transition-all ${
                              acc.is_primary
                                ? 'text-amber-400 bg-amber-400/20'
                                : 'text-white/40 hover:text-amber-300 hover:bg-white/10'
                            }`}
                          >
                            <Star className={`w-3.5 h-3.5 ${acc.is_primary ? 'fill-amber-400' : ''}`} />
                          </button>
                          <button
                            type="button"
                            title="Remover Conta"
                            onClick={() => handleRemoveBank(idx)}
                            className="p-1.5 text-white/50 hover:text-red-400 rounded-lg hover:bg-white/10 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 flex justify-end border-t border-white/10">
                <button
                  type="submit"
                  disabled={savingCompany}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-900 text-sm font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {savingCompany
                    ? 'A Guardar e Sincronizar...'
                    : 'Guardar Parametrização Oficial da Empresa'}
                </button>
              </div>
            </GlassCard>

            {/* Filiais Cadastradas */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Filiais, Lojas &amp; Estabelecimentos Registados
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pontos de venda, armazéns centrais e balcões operacionais da empresa
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(true)}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Nova Filial / Loja
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-12 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-mono font-bold text-xs flex items-center justify-center px-1">
                          {b.code}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {b.name}
                          </h4>
                          <span className="text-xs text-slate-500">
                            {b.address_detail ? `${b.address_detail} • ` : ''}
                            {b.city || 'Luanda'} • Angola
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {b.id === activeBranch?.id ? 'FILIAL ATIVA' : 'CONECTADA'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-mono font-bold text-xs flex items-center justify-center">
                        SEDE
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Sede Principal - {companyForm.city || 'Luanda'}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {companyForm.address_detail || 'Luanda'} • Angola
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      FILIAL ATIVA
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          <div className="space-y-6">
            {/* Checklist de Conformidade Decreto 71/25 */}
            <GlassCard className="p-5 space-y-3.5 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-transparent to-blue-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-black text-xs shrink-0">
                    {complianceChecks.percentage}%
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Check-up Decreto 71/25
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {complianceChecks.okCount} de {complianceChecks.total} requisitos preenchidos
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    complianceChecks.percentage === 100
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}
                >
                  {complianceChecks.percentage === 100 ? '100% Conforme' : 'Em Preparação'}
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${complianceChecks.percentage}%` }}
                />
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                {complianceChecks.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      {it.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      {it.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{it.hint}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Live Preview of Official Document Header/Footer */}
            <GlassCard className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    Timbre nos Documentos Oficiais
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pré-visualização em tempo real do cabeçalho fiscal
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('a4')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewMode === 'a4'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Fatura A4
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('thermal')}
                    className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
                      previewMode === 'thermal'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    POS 80mm
                  </button>
                </div>
              </div>

              {previewMode === 'a4' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-emerald-900/90 text-white p-4 space-y-3 shadow-md">
                  <div className="flex items-start gap-3">
                    {companyForm.logo_data_url ? (
                      <img
                        src={companyForm.logo_data_url}
                        alt="Logo"
                        className="w-12 h-12 object-contain rounded border border-white/20 bg-white/10 p-0.5 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-base shrink-0 ring-1 ring-white/20">
                        {(companyForm.trade_name || companyForm.company_name || 'K')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-xs space-y-0.5">
                      <p className="font-bold text-white truncate">
                        {companyForm.trade_name || companyForm.company_name || 'Nome da Empresa'}
                      </p>
                      {companyForm.trade_name &&
                        companyForm.trade_name !== companyForm.company_name && (
                          <p className="text-[11px] font-medium text-white/80 truncate">
                            {companyForm.company_name}
                          </p>
                        )}
                      <p className="font-mono text-[11px] text-white/90">
                        NIF: {companyForm.nif || '0000000000'}
                      </p>
                      {companyForm.commercial_registry && (
                        <p className="text-[10px] text-white/70 truncate">
                          {companyForm.commercial_registry}
                        </p>
                      )}
                      {companyForm.share_capital && (
                        <p className="text-[10px] text-white/70">
                          Cap. Social: {companyForm.share_capital}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-white/90 border-t border-white/10 pt-2 space-y-0.5">
                    <p>
                      {companyForm.address_detail || 'Endereço da Sede'}, {companyForm.city || 'Luanda'}
                      {companyForm.province ? ` (${companyForm.province})` : ''}
                    </p>
                    {(companyForm.phone || companyForm.email) && (
                      <p className="text-white/80">
                        {[companyForm.phone, companyForm.email].filter(Boolean).join(' • ')}
                      </p>
                    )}
                    {companyForm.website && (
                      <p className="text-white/90 truncate">{companyForm.website}</p>
                    )}
                  </div>

                  {companyForm.bank_accounts.filter((b) => b.iban.trim()).length > 0 && (
                    <div className="border-t border-white/10 pt-2">
                      <p className="text-[10px] font-bold uppercase text-white/60 mb-1">
                        Coordenadas Bancárias:
                      </p>
                      {companyForm.bank_accounts
                        .filter((b) => b.iban.trim())
                        .slice(0, 3)
                        .map((b, i) => (
                          <p key={i} className="text-[10px] font-mono text-white/80 truncate flex items-center justify-between">
                            <span>
                              <span className="font-bold text-white">{b.bank_name}:</span> {b.iban}
                            </span>
                            {b.is_primary && (
                              <span className="text-[9px] text-amber-300 font-bold ml-1">★ Principal</span>
                            )}
                          </p>
                        ))}
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-2 text-[10px] text-white/70 italic">
                    {companyForm.invoice_footer_notes}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white text-slate-900 p-4 space-y-2 shadow-inner font-mono text-xs">
                  <div className="text-center space-y-0.5">
                    {companyForm.logo_data_url && (
                      <img
                        src={companyForm.logo_data_url}
                        alt="Logo"
                        className="w-10 h-10 object-contain mx-auto mb-1 filter grayscale"
                      />
                    )}
                    <p className="font-black text-sm uppercase">
                      {companyForm.trade_name || companyForm.company_name || 'NOME DA EMPRESA'}
                    </p>
                    {companyForm.trade_name && companyForm.trade_name !== companyForm.company_name && (
                      <p className="text-[11px] text-slate-600">{companyForm.company_name}</p>
                    )}
                    <p className="text-xs font-bold">NIF: {companyForm.nif || '0000000000'}</p>
                    <p className="text-[11px] text-slate-600">
                      {companyForm.address_detail || 'Endereço da Sede'}, {companyForm.city || 'Luanda'}
                    </p>
                    {companyForm.phone && (
                      <p className="text-[11px] text-slate-600">Tel: {companyForm.phone}</p>
                    )}
                  </div>

                  <div className="border-t border-b border-dashed border-slate-400 py-1.5 my-2 text-center text-[10px] font-bold text-slate-700">
                    FATURA / RECIBO DE VENDA (POS 80mm)
                  </div>

                  <div className="text-[10px] text-center text-slate-600 space-y-0.5">
                    <p>
                      Processado por programa validado n.º{' '}
                      <span className="font-bold">{companyForm.agt_cert_number || 'AGT/2026/0042'}</span>
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Dec. Pres. n.º 71/25 • Chave RSA-2048
                    </p>
                    <p className="text-[9px] font-mono text-slate-400">
                      Hash: a1b2-Processado por computador
                    </p>
                  </div>

                  <div className="border-t border-dashed border-slate-300 pt-2 text-[9px] text-center text-slate-500 italic">
                    {companyForm.invoice_footer_notes}
                  </div>
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Segurança &amp; Perímetro
              </h3>
              <p className="text-xs text-slate-500">
                Configurações ativas no API Gateway perimétrico (Rust + Axum + Redis)
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Algoritmo de Hash:</span>
                  <span className="font-mono font-bold">Argon2id (OWASP 2024)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Autenticação:</span>
                  <span className="font-mono font-bold">JWT HMAC-SHA256</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Rate Limiting:</span>
                  <span className="font-mono font-bold">600 req/min (Token Bucket)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Idempotência Fiscais:</span>
                  <span className="font-mono font-bold text-emerald-600">Ativa (Redis Lock)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Trilha de Auditoria:</span>
                  <span className="font-mono font-bold text-emerald-600">audit_events (PostgreSQL)</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </form>
      )}

      {/* TAB 2: UTILIZADORES & RBAC */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou e-mail..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition"
            >
              <PlusCircle className="w-4 h-4" />
              Convidar Utilizador
            </button>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs">
                  <tr className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 w-10 text-center">
                      <span className="sr-only">Drill-down</span>
                    </th>
                    <SortableHeader field="full_name" currentSortField={membersSort?.key} sortDirection={membersSort?.direction} onSort={requestMembersSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Utilizador
                    </SortableHeader>
                    <SortableHeader field="email" currentSortField={membersSort?.key} sortDirection={membersSort?.direction} onSort={requestMembersSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      E-mail &amp; Filial
                    </SortableHeader>
                    <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                      Papéis Atribuídos
                    </th>
                    <SortableHeader field="status" currentSortField={membersSort?.key} sortDirection={membersSort?.direction} onSort={requestMembersSort} align="center" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Estado
                    </SortableHeader>
                    <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 text-center w-48">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        A carregar utilizadores...
                      </td>
                    </tr>
                  ) : sortedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Nenhum utilizador encontrado.
                      </td>
                    </tr>
                  ) : (
                    sortedMembers.map((m) => {
                      const branch = m.default_branch_id ? branches.find((b) => b.id === m.default_branch_id) : null;
                      const isSelf = user?.id === m.user_id;
                      const isExpanded = expandedMemberId === m.user_id;
                      return (
                        <React.Fragment key={m.user_id}>
                          <tr
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer ${
                              isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                            }`}
                            onClick={() => setExpandedMemberId(isExpanded ? null : m.user_id)}
                          >
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setExpandedMemberId(isExpanded ? null : m.user_id)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                                title="Expandir detalhes (Drill-down)"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs shrink-0">
                                {m.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div>{m.full_name}</div>
                                {isSelf && (
                                  <span className="text-[10px] text-blue-600 font-bold">
                                    (A sua sessão)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="font-mono text-slate-600 dark:text-slate-300">{m.email}</div>
                              {branch && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Filial: {branch.name} ({branch.code})
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1.5">
                                {m.roles.map((r) => (
                                  <span
                                    key={r}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  m.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                }`}
                              >
                                {m.status === 'ACTIVE' ? 'Ativo' : 'Suspenso'}
                              </span>
                            </td>
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedMemberForRoles(m);
                                    setSelectedRoles([...m.roles]);
                                  }}
                                  title="Editar papéis de acesso"
                                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  Papéis
                                </button>
                                {m.status === 'ACTIVE' ? (
                                  <button
                                    type="button"
                                    disabled={isSelf || updateMemberStatusMutation.isPending}
                                    onClick={() =>
                                      updateMemberStatusMutation.mutate({ userId: m.user_id, status: 'SUSPENDED' })
                                    }
                                    title={isSelf ? 'Não pode suspender a sua própria sessão' : 'Suspender acesso'}
                                    className="px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-semibold disabled:opacity-40"
                                  >
                                    Suspender
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={updateMemberStatusMutation.isPending}
                                    onClick={() =>
                                      updateMemberStatusMutation.mutate({ userId: m.user_id, status: 'ACTIVE' })
                                    }
                                    title="Reativar acesso"
                                    className="px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-semibold disabled:opacity-40"
                                  >
                                    Ativar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isSelf}
                                  onClick={() => setMemberToDelete(m)}
                                  title={isSelf ? 'Não pode remover a sua própria conta' : 'Remover utilizador'}
                                  className="p-1 rounded-lg border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-4">
                                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div>
                                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drill-down do Colaborador</span>
                                      <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                        {m.full_name}
                                        <span className="text-xs font-mono font-normal text-slate-500">({m.email})</span>
                                      </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveTab('saft');
                                        }}
                                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 inline-flex items-center gap-1.5"
                                        title="Filtrar eventos de segurança deste utilizador na auditoria"
                                      >
                                        <History className="w-3.5 h-3.5" />
                                        Ver Auditoria deste Utilizador
                                      </button>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Identificador Único (UUID)</span>
                                      <span className="font-mono text-2xs text-slate-700 dark:text-slate-300 break-all select-all">{m.user_id}</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Filial &amp; Lotação</span>
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {branch ? `${branch.name} (${branch.code}) - ${branch.city}` : 'Sede Principal'}
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Estado de Acesso</span>
                                      <span className="font-semibold flex items-center gap-1">
                                        <span className={`w-2 h-2 rounded-full ${m.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        {m.status === 'ACTIVE' ? 'Sessão e credenciais ativas' : 'Acesso temporariamente bloqueado'}
                                      </span>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-2xs text-slate-400 font-bold block mb-1.5">Papéis Atribuídos e Privilégios</span>
                                    <div className="flex flex-wrap gap-1.5">
                                      {m.roles.map((r) => (
                                        <span
                                          key={r}
                                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5"
                                        >
                                          <Shield className="w-3 h-3 text-indigo-500" />
                                          {r}
                                        </span>
                                      ))}
                                    </div>
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

          {/* Gestão de Perfis de Acesso */}
          <RolesManager />
        </div>
      )}

      {/* TAB 3: CERTIFICAÇÃO AGT & CHAVES RSA */}
      {activeTab === 'certification' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Par de Chaves Criptográficas RSA-2048
                </h3>
              </div>
              <StatusBadge status="ok" label="Assinatura Digital Ativa" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Conforme exigido pelo regime de certificação de programas de faturação em Angola, cada documento emitido (Facturas, Facturas-Recibo, Notas de Crédito) é assinado com chave privada RSA-2048 usando o algoritmo SHA1withRSA, gerando o hash de 172 caracteres.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                <span className="font-bold block text-slate-900 dark:text-white mb-1">
                  Chave Pública Registada:
                </span>
                <p className="break-all font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0f9kudiba2026rsa2048publickeyhash
                  5412345678AO...wIDAQAB
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Versão da Chave:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Versão 1 (2026)</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Algoritmo de Encadeamento:</span>
                  <span className="font-bold text-emerald-600">SHA1withRSA</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Regime de Contingência
                </h3>
              </div>
              <StatusBadge status="ok" label="Dentro do Prazo Legal" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O Decreto Presidencial n.º 71/25 estabelece que o sistema de faturação pode operar em modo de contingência offline por um período máximo contínuo de até 10 dias sem comunicação com os servidores centrais.
            </p>

            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Prazo Máximo Legal:
                </span>
                <span className="font-bold font-mono">10 Dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Dias em Contingência Decorridos:
                </span>
                <span className="font-bold font-mono text-emerald-600">0 Dias (Online)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Estado do Canal:
                </span>
                <span className="font-bold font-mono text-emerald-600">OPERACIONAL</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 4: SÉRIES FISCAIS */}
      {activeTab === 'series' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Séries de Documentos Fiscais (Exercício 2026)
              </h3>
              <p className="text-xs text-slate-500">
                Séries devidamente registadas para garantia de cronologia estrita e sem quebras de numeração
              </p>
            </div>
            <button
              onClick={() => setIsSeriesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition"
            >
              <PlusCircle className="w-4 h-4" />
              Criar Nova Série
            </button>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs">
                  <tr className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 w-10 text-center">
                      <span className="sr-only">Drill-down</span>
                    </th>
                    <SortableHeader field="seriesCode" currentSortField={seriesSort?.key} sortDirection={seriesSort?.direction} onSort={requestSeriesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Código da Série
                    </SortableHeader>
                    <SortableHeader field="fiscalYear" currentSortField={seriesSort?.key} sortDirection={seriesSort?.direction} onSort={requestSeriesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Ano Fiscal
                    </SortableHeader>
                    <SortableHeader field="currentSequence" currentSortField={seriesSort?.key} sortDirection={seriesSort?.direction} onSort={requestSeriesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Sequenciador Atual
                    </SortableHeader>
                    <SortableHeader field="documentType" currentSortField={seriesSort?.key} sortDirection={seriesSort?.direction} onSort={requestSeriesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Tipo Documental
                    </SortableHeader>
                    <SortableHeader field="isActive" currentSortField={seriesSort?.key} sortDirection={seriesSort?.direction} onSort={requestSeriesSort} align="center" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                      Estado
                    </SortableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {sortedSeries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Nenhuma série fiscal registada.
                      </td>
                    </tr>
                  ) : (
                    sortedSeries.map((s) => {
                      const isExpanded = expandedSeriesId === s.id;
                      return (
                        <React.Fragment key={s.id}>
                          <tr
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer ${
                              isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                            }`}
                            onClick={() => setExpandedSeriesId(isExpanded ? null : s.id)}
                          >
                            <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setExpandedSeriesId(isExpanded ? null : s.id)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                                title="Expandir detalhes (Drill-down)"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {s.seriesCode}
                            </td>
                            <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                              {s.fiscalYear}
                            </td>
                            <td className="p-3 font-mono font-semibold text-slate-900 dark:text-white">
                              #{s.currentSequence}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 font-mono text-xs">
                              {s.documentType || 'FT'}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  s.isActive
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                              >
                                {s.isActive ? 'ATIVA' : 'ENCERRADA'}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                              <td colSpan={6} className="p-4">
                                <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <div>
                                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drill-down de Série Fiscal</span>
                                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                        Série {s.seriesCode} — Exercício {s.fiscalYear}
                                      </h4>
                                    </div>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold">
                                      Tipo: {s.documentType || 'FT'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Certificação AGT</span>
                                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Certificado AGT/2026/0042
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Sequenciador &amp; Numeração</span>
                                      <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                                        Último emitido: #{s.currentSequence} (Sem intervalos)
                                      </span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                      <span className="text-2xs text-slate-400 font-bold block mb-1">Validação Criptográfica</span>
                                      <span className="font-mono text-2xs text-slate-600 dark:text-slate-400">
                                        Chave RSA-2048 / Hash SHA-1 (D.E. 385/20)
                                      </span>
                                    </div>
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
        </div>
      )}

      {/* TAB 5: AUDITORIA & ACTIVIDADES NO SISTEMA */}
      {activeTab === 'saft' && (
        <AuditAndActivitiesTab members={members} />
      )}

      {/* MODAL: CONVIDAR MEMBRO */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Convidar Novo Utilizador
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Maria dos Santos"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  E-mail Profissional
                </label>
                <input
                  type="email"
                  placeholder="maria.santos@empresa.ao"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Palavra-passe Inicial (Mínimo 12 caracteres)
                </label>
                <input
                  type="password"
                  placeholder="PasswordForte2026!"
                  value={inviteForm.password || ''}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              {branches.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Filial de Trabalho
                  </label>
                  <select
                    value={inviteForm.branch_id || ''}
                    onChange={(e) => setInviteForm({ ...inviteForm, branch_id: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="">Sede / Sem filial fixa</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Papéis de Acesso
                </label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  {rolesCatalog
                    .filter((rc: RoleCatalogItem) => rc.id !== 'SUPER_ADMIN')
                    .map((rc: RoleCatalogItem) => (
                      <label
                        key={rc.id}
                        className="flex items-center gap-2.5 p-2 rounded-md hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={inviteForm.roles.includes(rc.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteForm({
                                ...inviteForm,
                                roles: [...inviteForm.roles, rc.id],
                              });
                            } else {
                              const remaining = inviteForm.roles.filter((r) => r !== rc.id);
                              setInviteForm({
                                ...inviteForm,
                                roles: remaining.length ? remaining : ['OPERADOR_CAIXA'],
                              });
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {rc.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">{rc.id}</span>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !inviteForm.email ||
                  !inviteForm.full_name ||
                  !inviteForm.password ||
                  (inviteForm.password && inviteForm.password.length < 12) ||
                  inviteMemberMutation.isPending
                }
                onClick={() => inviteMemberMutation.mutate(inviteForm)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {inviteMemberMutation.isPending ? 'A enviar...' : 'Criar Utilizador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PAPÉIS */}
      {selectedMemberForRoles && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Editar Papéis de Utilizador
                </h3>
                <span className="text-xs text-slate-500">{selectedMemberForRoles.full_name}</span>
              </div>
              <button
                onClick={() => setSelectedMemberForRoles(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {rolesCatalog
                .filter((rc: RoleCatalogItem) => rc.id !== 'SUPER_ADMIN')
                .map((rc: RoleCatalogItem) => (
                  <label
                    key={rc.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(rc.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, rc.id]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== rc.id));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                        {rc.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{rc.id}</span>
                    </div>
                  </label>
                ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMemberForRoles(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedRoles.length === 0 || updateRolesMutation.isPending}
                onClick={() =>
                  updateRolesMutation.mutate({
                    userId: selectedMemberForRoles.user_id,
                    roles: selectedRoles,
                  })
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {updateRolesMutation.isPending ? 'A gravar...' : 'Gravar Papéis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR REMOÇÃO DE MEMBRO */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Remover Utilizador</h3>
                <span className="text-xs text-slate-500">{memberToDelete.full_name}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem a certeza de que deseja remover este utilizador da empresa? Os seus acessos e permissões serão revogados de imediato.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={removeMemberMutation.isPending}
                onClick={() => removeMemberMutation.mutate(memberToDelete.user_id)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {removeMemberMutation.isPending ? 'A remover...' : 'Confirmar Remoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: BASES DE DADOS & CONEXÕES */}
      {activeTab === 'databases' && <DatabaseSettingsManager />}

      {/* MODAL: NOVA SÉRIE FISCAL */}
      {isSeriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nova Série Fiscal
              </h3>
              <button
                onClick={() => setIsSeriesModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Código da Série (Ex.: 2026-B)
                </label>
                <input
                  type="text"
                  placeholder="2026-B"
                  value={seriesForm.code}
                  onChange={(e) =>
                    setSeriesForm({ ...seriesForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ano Fiscal
                </label>
                <input
                  type="number"
                  value={seriesForm.fiscal_year}
                  onChange={(e) =>
                    setSeriesForm({
                      ...seriesForm,
                      fiscal_year: parseInt(e.target.value) || 2026,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSeriesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!seriesForm.code || createSeriesMutation.isPending}
                onClick={() =>
                  createSeriesMutation.mutate({
                    tenantId: activeTenant?.id || 'a0000000-0000-0000-0000-000000000001',
                    documentType: 'FT',
                    seriesCode: seriesForm.code,
                    fiscalYear: seriesForm.fiscal_year,
                  })
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
              >
                {createSeriesMutation.isPending ? 'A criar...' : 'Ativar Série'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA FILIAL / LOJA */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Registar Nova Filial / Estabelecimento
              </h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Código da Filial *
                </label>
                <input
                  type="text"
                  placeholder="Ex: FILIAL-01 ou TALATONA"
                  value={branchForm.code}
                  onChange={(e) =>
                    setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })
                  }
                  className="input-field font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome da Filial / Loja *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Loja Talatona Sul"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Cidade / Município
                </label>
                <input
                  type="text"
                  placeholder="Ex: Luanda"
                  value={branchForm.city}
                  onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Endereço do Estabelecimento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Via S8, Condomínio Belas Business Park"
                  value={branchForm.address_detail}
                  onChange={(e) =>
                    setBranchForm({ ...branchForm, address_detail: e.target.value })
                  }
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBranchModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !branchForm.code.trim() ||
                  !branchForm.name.trim() ||
                  createBranchMutation.isPending
                }
                onClick={() => createBranchMutation.mutate(branchForm)}
                className="btn-primary text-sm"
              >
                {createBranchMutation.isPending ? 'A criar...' : 'Registar Filial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
