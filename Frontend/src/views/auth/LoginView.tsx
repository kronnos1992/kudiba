import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Calculator,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Receipt,
  ShieldCheck,
  Sun,
  Timer,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { authApi } from '../../api/auth';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TermsAndPoliciesModal } from '../../components/legal/TermsAndPoliciesModal';

const formatCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const highlights = [
  { icon: Receipt, label: 'Faturação e POS', detail: 'Operações fiscais num só lugar' },
  { icon: Calculator, label: 'Contabilidade', detail: 'Controlo financeiro simplificado' },
  { icon: Boxes, label: 'Inventário', detail: 'Stock e armazéns sempre alinhados' },
  { icon: Users, label: 'Recursos Humanos', detail: 'Equipas, salários e assiduidade' },
];

export interface LoginViewProps {
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onBackToLanding }) => {
  const { setSession } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState<number | null>(null);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<
    'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal'
  >('terms');

  useEffect(() => {
    if (lockSeconds === null) return;
    if (lockSeconds <= 0) {
      setLockSeconds(null);
      setError(null);
      return;
    }
    const timer = setTimeout(() => setLockSeconds((value) => (value === null ? null : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [lockSeconds]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lockSeconds !== null && lockSeconds > 0) return;
    setError(null);
    setLockSeconds(null);
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setSession(response);
    } catch (err: unknown) {
      const data =
        err && typeof err === 'object' && 'response' in err
          ? (err as {
              response?: {
                status?: number;
                data?: { detail?: string; code?: string; retry_after_seconds?: number };
              };
            }).response
          : undefined;
      const errorMsg = data?.data?.detail;

      if (data?.status === 423 && data?.data?.code === 'ACCOUNT_LOCKED') {
        const seconds =
          typeof data.data.retry_after_seconds === 'number' && data.data.retry_after_seconds > 0
            ? data.data.retry_after_seconds
            : 15 * 60;
        setError(
          `Conta temporariamente bloqueada por excesso de tentativas falhadas. Tente novamente em ${formatCountdown(seconds)}.`
        );
        setLockSeconds(seconds);
      } else {
        const message =
          errorMsg ||
          (err instanceof Error && err.message === 'Network Error'
            ? 'Não foi possível contactar o servidor de autenticação. Verifique a ligação e tente novamente.'
            : 'Credenciais inválidas. Verifique o email e a palavra-passe.');
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f6f3] p-0 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:p-4 lg:p-8">
      <div className="mx-auto flex min-h-screen max-w-[1440px] overflow-hidden bg-white shadow-xl shadow-slate-900/5 dark:bg-slate-900 sm:min-h-[min(900px,calc(100vh-2rem))] sm:rounded-[28px] lg:min-h-[min(900px,calc(100vh-4rem))]">
        <section className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-[#073b2c] p-10 text-white lg:flex xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(52,211,153,0.22),transparent_38%),radial-gradient(ellipse_at_85%_90%,rgba(20,184,166,0.2),transparent_35%)]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-900 shadow-lg shadow-black/10">
                <span className="text-2xl font-black tracking-tighter">K</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold tracking-tight">Kudiba</span>
                  <span className="rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                    ERP
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-emerald-100/70">Gestão simples. Negócios em movimento.</p>
              </div>
            </div>

            <div className="mt-20 max-w-xl xl:mt-24">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-100">
                <ShieldCheck className="h-4 w-4" />
                Gestão empresarial integrada
              </div>
              <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[52px]">
                Tudo o que a sua empresa precisa,
                <span className="text-emerald-300"> num só lugar.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/75">
                Simplifique a gestão do dia a dia e tenha mais tempo para fazer o seu negócio crescer.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-12 rounded-3xl border border-white/15 bg-white/[0.08] p-5 shadow-2xl shadow-black/10 backdrop-blur-sm xl:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-100/65">A sua operação, de forma clara</p>
                <p className="mt-1 text-sm font-semibold">Uma plataforma. Toda a empresa.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-200">
                <BadgeCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {highlights.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="flex items-start gap-3 rounded-2xl bg-slate-950/15 p-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-1 text-[11px] leading-4 text-emerald-50/65">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 mt-8 text-xs text-emerald-100/55">
            Feito para empresas que querem avançar.
          </p>
        </section>

        <section className="flex min-h-screen w-full flex-col px-6 py-6 dark:bg-slate-900 sm:px-10 lg:min-h-0 lg:w-[48%] lg:px-12 xl:px-20">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onBackToLanding && (
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
                  title="Voltar ao Website Oficial"
                >
                  <ArrowLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Website</span>
                </button>
              )}
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Acesso seguro
              </div>
            </div>
            <button
              onClick={toggleTheme}
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Alternar modo escuro / claro"
              aria-label="Alternar modo escuro / claro"
            >
              {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </header>

          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white">
                  <span className="text-xl font-black">K</span>
                </div>
                <span className="text-xl font-extrabold tracking-tight dark:text-white">Kudiba</span>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                Bem-vindo de volta
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-[34px]">
                Entre na sua conta
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Introduza os seus dados para continuar para o Kudiba ERP.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className={`mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  lockSeconds !== null
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300'
                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                {lockSeconds !== null ? (
                  <Timer className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>
                  {lockSeconds !== null ? (
                    <>
                      Conta temporariamente bloqueada. Tente novamente em{' '}
                      <strong className="tabular-nums">{formatCountdown(lockSeconds)}</strong>.
                    </>
                  ) : (
                    error
                  )}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="username"
                    placeholder="nome@empresa.ao"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Palavra-passe
                  </label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Introduza a sua palavra-passe"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-slate-600 dark:focus:border-emerald-400 dark:focus:ring-emerald-400/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:text-slate-200"
                    title={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                    aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (lockSeconds !== null && lockSeconds > 0)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A entrar...
                  </>
                ) : lockSeconds !== null && lockSeconds > 0 ? (
                  <>
                    <Timer className="h-4 w-4" />
                    Bloqueado ({formatCountdown(lockSeconds)})
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              As suas credenciais são transmitidas em segurança
            </div>
          </div>

          <footer className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Serviço disponível
              </span>
              <button
                type="button"
                onClick={() => {
                  setLegalModalTab('fiscal');
                  setIsLegalModalOpen(true);
                }}
                className="transition-opacity hover:opacity-80"
              >
                <StatusBadge status="ok" label="FE/528/AGT/2026" size="small" />
              </button>
            </div>
            <nav
              aria-label="Informação legal"
              className="flex flex-wrap justify-center gap-x-3 gap-y-2 text-[11px] text-slate-400 dark:text-slate-500"
            >
              {(
                [
                  ['terms', 'Termos de Uso'],
                  ['privacy', 'Privacidade (Lei 22/11)'],
                  ['data_processing', 'Tratamento de Dados'],
                  ['subscription', 'Contrato de Subscrição'],
                ] as const
              ).map(([tab, label], index) => (
                <React.Fragment key={tab}>
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    onClick={() => {
                      setLegalModalTab(tab);
                      setIsLegalModalOpen(true);
                    }}
                    className="underline underline-offset-2 transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
                  >
                    {label}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          </footer>
        </section>
      </div>

      <TermsAndPoliciesModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </main>
  );
};
