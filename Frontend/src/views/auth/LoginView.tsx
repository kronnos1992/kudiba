import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  Loader2,
  Timer,
  Receipt,
  Calculator,
  Boxes,
  Users,
  Eye,
  EyeOff,
  Sun,
  Moon,
  CheckCircle2,
  Sparkles,
  QrCode,
  Building2,
  TrendingUp,
  Cpu,
  ArrowRight,
  BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { authApi } from '../../api/auth';
import { StatusBadge } from '../../components/common/StatusBadge';

const formatCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const LoginView: React.FC = () => {
  const { setSession } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();

  const [email, setEmail] = useState('admin@kudiba.ao');
  const [password, setPassword] = useState('Admin@Kudiba2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (lockSeconds === null) return;
    if (lockSeconds <= 0) {
      setLockSeconds(null);
      setError(null);
      return;
    }
    const t = setTimeout(() => setLockSeconds((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [lockSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSelectPreset = (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail);
    setPassword(presetPass);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* =========================================================================
          PAINEL ESQUERDO: FLYER KUDIBA ERP (SHOWCASE INSTITUCIONAL & TRIBUTÁRIO)
          ========================================================================= */}
      <div className="relative w-full lg:w-7/12 xl:w-3/5 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white p-6 sm:p-10 lg:p-14 flex flex-col justify-between overflow-hidden shadow-2xl">
        {/* Elementos Decorativos de Fundo / Iluminação */}
        <div className="absolute top-0 right-0 -mt-24 -mr-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* TOPO DO FLYER: Branding & Badges de Certificação */}
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 p-0.5 shadow-xl shadow-emerald-900/50">
                <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                  <span className="font-black text-2xl tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-300">
                    K
                  </span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-white">Kudiba</span>
                  <span className="px-2 py-0.5 text-xs font-black tracking-wide uppercase rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    ERP
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 font-medium tracking-wide">
                  Solução Integrada de Gestão Empresarial · Angola
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-500/30 backdrop-blur-md">
              <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-semibold text-emerald-200 tracking-wide">
                Certificação AGT n.º 42/AGT/2026
              </span>
            </div>
          </div>

          {/* HEADLINE PRINCIPAL DO FLYER */}
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Conformidade Fiscal Total · Decreto Presidencial 71/25</span>
            </div>
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-tight mb-4">
              A inteligência e o rigor fiscal que a sua empresa merece.
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Desenvolvido com tecnologia de topo para responder com exatidão às exigências da
              Administração Geral Tributária (AGT) e ao Plano Geral de Contabilidade (PGC) de Angola.
            </p>
          </div>

          {/* GRID DE MÓDULOS DESTAQUE (4 CARDS VISUAIS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Card 1: Faturação & POS */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-200 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Faturação &amp; POS AGT
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Assinatura digital RSA-2048 em tempo real, QR Code oficial, impressão térmica e
                    exportação SAF-T AO validada.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Contabilidade Geral PGC */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-200 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Contabilidade PGC Angola
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Decreto n.º 82/01 (Classes 0 a 8), Balancetes a 4 e 6 Colunas, DRE, DFC e Balanço
                    patrimonial automatizado.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Inventário & CMP */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-200 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:scale-105 transition-transform">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Gestão de Stocks &amp; CMP
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Custeio a Custo Médio Ponderado, multi-armazéns, rastreabilidade de lotes, controlo
                    de validade e saídas automáticas.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Salários & Recursos Humanos */}
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-emerald-500/40 backdrop-blur-md transition-all duration-200 group">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Salários, IRT &amp; INSS
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Folha salarial adaptada à Lei Geral do Trabalho 12/23, escalões de IRT 28/20 e
                    retenção de INSS patronal e laboral.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULADOR VISUAL DE DOCUMENTO FISCAL VERIFICADO (FLYER BADGE) */}
          <div className="hidden sm:flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-slate-900/80 border border-emerald-500/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Motor Fiscal Descentralizado</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Rust Core
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Latência ultrabaixa (&lt;10ms) · Encriptação SHA-256 Chained Hash
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Moeda Operacional
              </span>
              <p className="text-xs font-extrabold text-white">Kwanza Angolano (AOA)</p>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO FLYER: Métricas e Selos de Confiança */}
        <div className="relative z-10 pt-8 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>Multi-Filial &amp; Holding</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Auditoria SAFT-AO XML</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-teal-400" />
              <span>Gateway Perimétrico :8080</span>
            </div>
          </div>
          <span className="text-slate-500 text-[11px]">
            República de Angola · Ministério das Finanças
          </span>
        </div>
      </div>

      {/* =========================================================================
          PAINEL DIREITO: FORMULÁRIO DE LOGIN (ELEGANTE, MODERNO E RESPONSIVO)
          ========================================================================= */}
      <div className="w-full lg:w-5/12 xl:w-2/5 flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16">
        {/* Topo do painel de login: seletor de tema claro/escuro */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Ambiente Autenticado Seguro</span>
          </div>

          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs cursor-pointer"
            title="Alternar Modo Escuro / Claro"
          >
            {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Conteúdo Central do Formulário */}
        <div className="w-full max-w-md mx-auto my-auto">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Entrar na sua Conta
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Introduza as suas credenciais de utilizador para aceder ao ERP e terminar operações fiscais.
            </p>
          </div>

          {/* Mensagem de Erro / Bloqueio Temporário */}
          {error && (
            <div
              className={`mb-6 p-4 rounded-xl border text-sm animate-in fade-in duration-200 ${
                lockSeconds !== null
                  ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {lockSeconds !== null ? (
                  <Timer className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Lock className="w-4 h-4 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <div>
                  {lockSeconds !== null ? (
                    <>
                      Conta temporariamente bloqueada por excesso de tentativas falhadas. Tente
                      novamente em{' '}
                      <span className="font-bold tabular-nums">{formatCountdown(lockSeconds)}</span>.
                    </>
                  ) : (
                    error
                  )}
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Email Corporativo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-xs"
                  placeholder="admin@kudiba.ao"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Palavra-passe
                </label>
                <span className="text-xs text-slate-400 dark:text-slate-500">Mínimo 8 carateres</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-xs"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (lockSeconds !== null && lockSeconds > 0)}
              className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-700/25 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A autenticar na rede Kudiba...</span>
                </>
              ) : lockSeconds !== null && lockSeconds > 0 ? (
                <>
                  <Timer className="w-4 h-4" />
                  <span>Conta Bloqueada ({formatCountdown(lockSeconds)})</span>
                </>
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Atalhos Rápidos para Demonstração / Testes */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2.5 uppercase tracking-wider">
              Acesso Rápido para Testes:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('admin@kudiba.ao', 'Admin@Kudiba2026!')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors text-center cursor-pointer"
              >
                Admin Geral
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset('operador@kudiba.ao', 'Operador@Kudiba2026!')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors text-center cursor-pointer"
              >
                Operador POS
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSelectPreset('contabilidade@kudiba.ao', 'Contabilista@Kudiba2026!')
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors text-center cursor-pointer"
              >
                Contabilista
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé do Formulário */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Gateway Perimétrico :8080</span>
          </div>
          <StatusBadge status="ok" label="Certificado Fiscal Ativo" size="small" />
        </div>
      </div>
    </div>
  );
};
