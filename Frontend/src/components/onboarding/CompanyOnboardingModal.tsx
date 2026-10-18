import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  MapPin,
  ShieldCheck,
  Landmark,
  Upload,
  Trash2,
  Plus,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Phone,
  Mail,
  Globe,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';
import { invoicingApi } from '../../api/invoicing';
import { TenantBankAccount } from '../../types/auth';
import { toast } from '../../stores/toastStore';

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

const ANGOLA_BANKS = [
  'BAI - Banco Angolano de Investimentos',
  'BFA - Banco de Fomento Angola',
  'BIC - Banco BIC',
  'BMA - Banco Millennium Atlântico',
  'SOL - Banco Sol',
  'BPC - Banco de Poupança e Crédito',
  'SBA - Standard Bank Angola',
  'BCGA - Banco Caixa Geral Angola',
  'KEVE - Banco Keve',
  'BNI - Banco de Negócios Internacional',
  'VTB África',
  'Outro Banco',
];

interface CompanyOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  forceAllowClose?: boolean;
}

export const CompanyOnboardingModal: React.FC<CompanyOnboardingModalProps> = ({
  isOpen,
  onClose,
  forceAllowClose = false,
}) => {
  const { activeTenant, updateActiveTenantSettings } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [nif, setNif] = useState('');
  const [commercialRegistry, setCommercialRegistry] = useState('');
  const [shareCapital, setShareCapital] = useState('');
  const [currency, setCurrency] = useState('AOA');

  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [addressDetail, setAddressDetail] = useState('');
  const [city, setCity] = useState('Luanda');
  const [province, setProvince] = useState('Luanda');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('AO');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');

  const [taxRegimeCode, setTaxRegimeCode] = useState('REGIME_GERAL');
  const [taxOfficeCode, setTaxOfficeCode] = useState('1.ª Repartição Fiscal de Luanda');
  const [agtCertNumber, setAgtCertNumber] = useState('AGT/2026/0042');
  const [defaultWithholdingRate, setDefaultWithholdingRate] = useState<number>(6.5);
  const [invoiceFooterNotes, setInvoiceFooterNotes] = useState(
    'Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.'
  );

  const [bankAccounts, setBankAccounts] = useState<TenantBankAccount[]>([
    {
      bank_name: 'BAI - Banco Angolano de Investimentos',
      iban: 'AO06.0040.0000.0000.0000.0000.0',
      account_number: '',
      swift: 'BAIPAOLU',
      currency: 'AOA',
      is_primary: true,
    },
  ]);

  useEffect(() => {
    if (!isOpen || !activeTenant) return;
    setCompanyName(activeTenant.company_name || activeTenant.name || '');
    setTradeName(activeTenant.trade_name || activeTenant.name || '');
    setNif(activeTenant.nif || activeTenant.taxId || '');
    setCommercialRegistry(activeTenant.commercial_registry || '');
    setShareCapital(activeTenant.share_capital || '');
    setCurrency(activeTenant.currency || 'AOA');
    setLogoDataUrl(activeTenant.logo_data_url || null);
    setAddressDetail(activeTenant.address_detail || '');
    setCity(activeTenant.city || 'Luanda');
    setProvince(activeTenant.province || 'Luanda');
    setPostalCode(activeTenant.postal_code || '');
    setCountry(activeTenant.country || 'AO');
    setPhone(activeTenant.phone || '');
    setEmail(activeTenant.email || '');
    setWebsite(activeTenant.website || '');
    setTaxRegimeCode(activeTenant.tax_regime_code || 'REGIME_GERAL');
    setTaxOfficeCode(activeTenant.tax_office_code || '1.ª Repartição Fiscal de Luanda');
    setAgtCertNumber(activeTenant.agt_cert_number || 'AGT/2026/0042');
    setDefaultWithholdingRate(activeTenant.default_withholding_rate ?? 6.5);
    setInvoiceFooterNotes(
      activeTenant.invoice_footer_notes ||
        'Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento.'
    );
    if (activeTenant.bank_accounts && activeTenant.bank_accounts.length > 0) {
      setBankAccounts(activeTenant.bank_accounts);
    }
  }, [isOpen, activeTenant]);

  if (!isOpen || !activeTenant) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      toast.warning('O logótipo não deve exceder 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const addBankAccount = () => {
    setBankAccounts((prev) => [
      ...prev,
      {
        bank_name: 'BFA - Banco de Fomento Angola',
        iban: 'AO06.0006.0000.',
        account_number: '',
        swift: '',
        currency: 'AOA',
        is_primary: prev.length === 0,
      },
    ]);
  };

  const updateBankAccount = (index: number, field: keyof TenantBankAccount, value: any) => {
    setBankAccounts((prev) =>
      prev.map((acc, i) => {
        if (field === 'is_primary' && value === true) {
          return { ...acc, is_primary: i === index };
        }
        return i === index ? { ...acc, [field]: value } : acc;
      })
    );
  };

  const removeBankAccount = (index: number) => {
    setBankAccounts((prev) => prev.filter((_, i) => i !== index));
  };

  const validateCurrentStep = (): boolean => {
    if (step === 1) {
      if (!companyName.trim() || companyName.trim().length < 2) {
        toast.warning('Indique a Denominação Social (Razão Social) da empresa.');
        return false;
      }
      if (!nif.trim() || nif.trim().length < 5) {
        toast.warning('Indique um NIF válido da empresa.');
        return false;
      }
    }
    if (step === 2) {
      if (!addressDetail.trim()) {
        toast.warning('O endereço completo da sede é obrigatório para emissão de documentos fiscais e SAF-T (AO).');
        return false;
      }
      if (!city.trim()) {
        toast.warning('Indique a cidade / município da sede.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (step < 4) setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
  };

  const handleFinish = async () => {
    if (!validateCurrentStep()) return;
    setSaving(true);
    try {
      const cleanedBanks = bankAccounts.filter(
        (b) => b.bank_name.trim() !== '' && b.iban.trim() !== ''
      );
      const payload = {
        company_name: companyName.trim(),
        trade_name: tradeName.trim() || companyName.trim(),
        nif: nif.trim(),
        commercial_registry: commercialRegistry.trim() || null,
        share_capital: shareCapital.trim() || null,
        currency,
        logo_data_url: logoDataUrl,
        address_detail: addressDetail.trim(),
        city: city.trim(),
        province: province.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || 'AO',
        phone: phone.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        tax_regime_code: taxRegimeCode,
        tax_office_code: taxOfficeCode.trim() || null,
        agt_cert_number: agtCertNumber.trim() || null,
        default_withholding_rate: Number(defaultWithholdingRate) || 6.5,
        invoice_footer_notes: invoiceFooterNotes.trim() || null,
        bank_accounts: cleanedBanks,
        onboarding_completed: true,
      };

      const saved = await authApi.updateTenantSettings(payload);

      try {
        await invoicingApi.syncFiscalTenant({
          ...payload,
          slug: activeTenant.slug || saved.slug,
        });
      } catch {
        // Sincronização secundária silenciosa caso o motor fiscal esteja em arranque
      }

      updateActiveTenantSettings({
        ...saved,
        onboarding_completed: true,
      });

      toast.success('Parametrização oficial da empresa concluída com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          'Erro ao guardar a parametrização da empresa.'
      );
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { id: 1, title: 'Identificação Legal', subtitle: 'NIF, Razão Social & Registo', icon: Building2 },
    { id: 2, title: 'Marca & Contactos', subtitle: 'Logótipo, Sede & Canais', icon: MapPin },
    { id: 3, title: 'Enquadramento Fiscal', subtitle: 'IVA, Repartição & AGT', icon: ShieldCheck },
    { id: 4, title: 'Bancos & Documentos', subtitle: 'IBANs & Timbre Oficial', icon: Landmark },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden my-auto">
        {/* Top Banner */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 sm:py-5 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
                  Configuração Inicial Pós-Subscrição
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                Parametrização Oficial da Empresa para Documentos Fiscais
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Configure os dados cadastrais, logótipo, parâmetros AGT e coordenadas bancárias que constarão nas Faturas, Recibos, SAF-T (AO) e Folha Salarial.
              </p>
            </div>
          </div>
          {(forceAllowClose || activeTenant.onboarding_completed) && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-colors shrink-0"
              title="Fechar assistente"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {steps.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (s.id < step || validateCurrentStep()) {
                    setStep(s.id as 1 | 2 | 3 | 4);
                  }
                }}
                className={`flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 text-left border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300'
                    : isDone
                    ? 'border-emerald-400 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">
                    {s.id}. {s.title}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {s.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="p-4 sm:p-6 max-h-[65vh] overflow-y-auto bg-white dark:bg-slate-900">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  1. Identificação Legal e Registo Comercial
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Estes dados identificam juridicamente o sujeito passivo perante a AGT e constam obrigatoriamente em todos os documentos oficiais.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Denominação Social (Razão Social) *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Kudiba Comercial Angola, Lda."
                    className="input-field"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Nome oficial tal como registado na Certidão Comercial e no NIF.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nome Comercial / Insígnia (Marca)
                  </label>
                  <input
                    type="text"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Ex: Kudiba ERP Angola"
                    className="input-field"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Nome público em destaque nos cabeçalhos das faturas e talões POS.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    NIF (Número de Identificação Fiscal) *
                  </label>
                  <input
                    type="text"
                    value={nif}
                    onChange={(e) => setNif(e.target.value)}
                    placeholder="Ex: 5417123456"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Matrícula / Conservatória do Registo Comercial
                  </label>
                  <input
                    type="text"
                    value={commercialRegistry}
                    onChange={(e) => setCommercialRegistry(e.target.value)}
                    placeholder="Ex: Matrícula n.º 45.892-23/CML"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Capital Social Realizado
                  </label>
                  <input
                    type="text"
                    value={shareCapital}
                    onChange={(e) => setShareCapital(e.target.value)}
                    placeholder="Ex: 5.000.000,00 AOA"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Moeda Funcional Padrão
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input-field"
                  >
                    <option value="AOA">AOA — Kwanza Angolano (Kz)</option>
                    <option value="USD">USD — Dólar Norte-Americano ($)</option>
                    <option value="EUR">EUR — Euro (€)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  2. Identidade Visual, Sede Social e Contactos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Carregue o logótipo oficial da empresa e defina a localização e contactos que serão impressos no topo dos documentos.
                </p>
              </div>

              {/* Logo Upload Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {logoDataUrl ? (
                    <img
                      src={logoDataUrl}
                      alt="Logótipo da Empresa"
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <Building2 className="w-7 h-7 text-slate-400 mx-auto" />
                      <span className="text-[10px] text-slate-400 font-medium block mt-1">
                        Sem Logo
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                    Logótipo Institucional para Documentos Oficiais
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Formato PNG, JPG ou SVG (fundo transparente recomendado, máx. 1.5 MB). Será exibido nas Faturas A4, Recibos de Salário e cabeçalho do ERP.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Carregar Logótipo
                    </button>
                    {logoDataUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoDataUrl(null)}
                        className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Endereço Completo da Sede (Rua, Avenida, N.º, Edifício, Bairro) *
                  </label>
                  <input
                    type="text"
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="Ex: Avenida 4 de Fevereiro, n.º 120, 3.º Andar, Ingombota"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Cidade / Município *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Luanda"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Província
                  </label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Código Postal / Caixa Postal
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Ex: CP 1245 Luanda"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    País (ISO-2)
                  </label>
                  <input
                    type="text"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase())}
                    maxLength={2}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Telefone Oficial
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="input-field pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    E-mail Institucional (Faturação / Geral)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="geral@suaempresa.co.ao"
                      className="input-field pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Website Institucional
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://www.suaempresa.co.ao"
                      className="input-field pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  3. Enquadramento Fiscal AGT &amp; Regras de Faturação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Parametrize o regime de IVA aplicável ao sujeito passivo, a repartição fiscal e as menções obrigatórias do Decreto Presidencial n.º 71/25.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    code: 'REGIME_GERAL',
                    title: 'Regime Geral de IVA (14%)',
                    desc: 'Contribuintes com contabilidade organizada ou volume de negócios superior ao limiar legal.',
                  },
                  {
                    code: 'REGIME_SIMPLIFICADO',
                    title: 'Regime Simplificado (7%)',
                    desc: 'Sujeitos passivos enquadrados no regime simplificado de tributação em sede de IVA.',
                  },
                  {
                    code: 'REGIME_EXCLUSAO',
                    title: 'Regime de Exclusão (0% - M04)',
                    desc: 'Não sujeição a IVA nos termos da legislação fiscal angolana em vigor.',
                  },
                ].map((reg) => (
                  <button
                    key={reg.code}
                    type="button"
                    onClick={() => setTaxRegimeCode(reg.code)}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      taxRegimeCode === reg.code
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {reg.title}
                      </span>
                      {taxRegimeCode === reg.code && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {reg.desc}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Repartição Fiscal de Domicílio
                  </label>
                  <input
                    type="text"
                    value={taxOfficeCode}
                    onChange={(e) => setTaxOfficeCode(e.target.value)}
                    placeholder="Ex: 1.ª Repartição Fiscal de Luanda"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    N.º de Certificação Software AGT
                  </label>
                  <input
                    type="text"
                    value={agtCertNumber}
                    onChange={(e) => setAgtCertNumber(e.target.value)}
                    placeholder="Ex: AGT/2026/0042"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Taxa de Retenção na Fonte Padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={defaultWithholdingRate}
                    onChange={(e) => setDefaultWithholdingRate(parseFloat(e.target.value) || 0)}
                    className="input-field font-mono"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Taxa legal padrão de serviços em Angola: 6.5% (Lei n.º 26/20).
                  </p>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Menção Legal / Observações Padrão no Rodapé das Faturas
                  </label>
                  <textarea
                    rows={2}
                    value={invoiceFooterNotes}
                    onChange={(e) => setInvoiceFooterNotes(e.target.value)}
                    placeholder="Ex: Os bens ou serviços foram colocados à disposição do adquirente na data e local do presente documento."
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    4. Coordenadas Bancárias nos Documentos &amp; Timbre Oficial
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Adicione as contas bancárias (IBAN) que aparecerão nas Faturas e veja a pré-visualização do cabeçalho oficial da sua empresa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBankAccount}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Conta / IBAN
                </button>
              </div>

              <div className="space-y-2.5">
                {bankAccounts.map((acc, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                  >
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Instituição Bancária
                      </label>
                      <input
                        type="text"
                        list="angola-banks-list"
                        value={acc.bank_name}
                        onChange={(e) => updateBankAccount(idx, 'bank_name', e.target.value)}
                        placeholder="Ex: BAI, BFA, BIC..."
                        className="input-field text-xs py-1.5"
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        IBAN Oficial
                      </label>
                      <input
                        type="text"
                        value={acc.iban}
                        onChange={(e) => updateBankAccount(idx, 'iban', e.target.value)}
                        placeholder="AO06.0040.0000.0000.0000.0000.0"
                        className="input-field font-mono text-xs py-1.5"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-0.5">
                        Moeda
                      </label>
                      <select
                        value={acc.currency || 'AOA'}
                        onChange={(e) => updateBankAccount(idx, 'currency', e.target.value)}
                        className="input-field text-xs py-1.5"
                      >
                        <option value="AOA">AOA</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <div className="md:col-span-1 flex items-end justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => removeBankAccount(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Remover conta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <datalist id="angola-banks-list">
                  {ANGOLA_BANKS.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Live Official Document Header & Footer Preview */}
              <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white shadow-xs overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    Pré-visualização do Timbre nos Documentos Oficiais (Fatura A4 / Recibo)
                  </span>
                  <span className="text-[10px] text-slate-300 font-mono">
                    Decreto Presidencial n.º 71/25 (AGT)
                  </span>
                </div>
                <div className="p-5 space-y-4 bg-white text-slate-900">
                  <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-start gap-3.5">
                      {logoDataUrl ? (
                        <img
                          src={logoDataUrl}
                          alt="Logo"
                          className="w-14 h-14 object-contain rounded-lg border border-slate-200 p-1 bg-white"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                          {(tradeName || companyName || 'K').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-sm text-slate-900">
                          {tradeName || companyName || 'Nome Comercial da Empresa'}
                        </p>
                        {tradeName && tradeName !== companyName && (
                          <p className="font-semibold text-slate-700">{companyName}</p>
                        )}
                        <p className="text-slate-600 font-mono">
                          NIF: {nif || '0000000000'}
                          {commercialRegistry ? ` • ${commercialRegistry}` : ''}
                        </p>
                        {shareCapital && (
                          <p className="text-slate-500">Capital Social: {shareCapital}</p>
                        )}
                        <p className="text-slate-500">
                          {addressDetail || 'Endereço da Sede'}, {city || 'Luanda'}
                          {province && province !== city ? ` (${province})` : ''} — {country || 'AO'}
                        </p>
                        {(phone || email || website) && (
                          <p className="text-slate-500 text-[11px]">
                            {[phone, email, website].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs uppercase tracking-wider">
                        FACTURA ORIGINAL
                      </span>
                      <p className="text-xs font-mono text-slate-600 mt-1">FT KUD26/000001</p>
                      <p className="text-[11px] text-slate-500">
                        Moeda: {currency} | IVA: {taxRegimeCode}
                      </p>
                    </div>
                  </div>

                  {bankAccounts.filter((b) => b.iban.trim()).length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Coordenadas Bancárias para Pagamento:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {bankAccounts
                          .filter((b) => b.iban.trim())
                          .map((b, i) => (
                            <p key={i} className="text-slate-700 font-mono text-[11px]">
                              <strong className="font-sans">{b.bank_name}:</strong> {b.iban} (
                              {b.currency || 'AOA'})
                            </p>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="italic">{invoiceFooterNotes}</span>
                    <span className="font-mono text-[10px] text-slate-600 shrink-0">
                      Processado por programa validado n.º {agtCertNumber || 'AGT/2026/0042'} • Kudiba ERP
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="btn-secondary text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                Passo Anterior
              </button>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Passo {step} de 4 — Campos com * são obrigatórios
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(forceAllowClose || activeTenant.onboarding_completed) && (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs"
              >
                Configurar mais tarde
              </button>
            )}

            {step < 4 ? (
              <button type="button" onClick={handleNext} className="btn-primary text-xs">
                Seguinte
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="btn-primary text-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving ? 'A Guardar Parametrização...' : 'Concluir Parametrização Oficial'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
