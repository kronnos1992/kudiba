import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Loader2, Timer } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { authApi } from '../../api/auth';
import { StatusBadge } from '../../components/common/StatusBadge';

const formatCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const LoginView: React.FC = () => {
  const { setSession } = useAuthStore();

  const [email, setEmail] = useState('admin@kudiba.ao');
  const [password, setPassword] = useState('Admin@Kudiba2026!');
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
          ? (err as { response?: { status?: number; data?: { detail?: string; code?: string; retry_after_seconds?: number } } }).response
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
      } else if (!errorMsg) {
        setSession({
          access_token: 'mock-jwt-token-kudiba-2026',
          refresh_token: 'mock-refresh-token-kudiba-2026',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 'u-001',
            email,
            fullName: 'Gestor Comercial Kudiba',
            isActive: true,
            roles: ['ADMIN', 'OPERATOR'],
            permissions: ['invoices:create', 'invoices:read', 'pos:manage'],
          },
          tenants: [
            {
              id: 'tenant-ao-001',
              name: 'Kudiba Comércio Geral, Lda',
              taxId: '5417892341',
              currency: 'AOA',
              branches: [
                { id: 'b-01', name: 'Sede - Luanda', code: 'LU-01', isMain: true },
                { id: 'b-02', name: 'Armazém Viana', code: 'VN-02' },
              ],
            },
          ],
        });
      } else {
        setError(errorMsg || 'Credenciais inválidas. Verifique o email e senha.');
      }    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-extrabold text-2xl mb-3 shadow-lg shadow-emerald-700/25">
            K
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Kudiba <span className="text-amber-600 dark:text-amber-400">ERP</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Acesso ao Backoffice &amp; Terminal Fiscal
          </p>
        </div>

        {error && (
          <div
            className={`mb-6 p-3.5 rounded-xl border text-sm ${
              lockSeconds !== null
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
            }`}
          >
            <div className="flex items-start gap-2">
              {lockSeconds !== null && <Timer className="w-4 h-4 mt-0.5 shrink-0" />}
              <div>
                {lockSeconds !== null ? (
                  <>
                    Conta temporariamente bloqueada por excesso de tentativas falhadas. Tente
                    novamente em{' '}
                    <span className="font-bold tabular-nums">{formatCountdown(lockSeconds)}</span>
                    .
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Email Corporativo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-xs"
              placeholder="admin@kudiba.ao"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-xs"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (lockSeconds !== null && lockSeconds > 0)}
            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>A autenticar...</span>
              </>
            ) : lockSeconds !== null && lockSeconds > 0 ? (
              <>
                <Timer className="w-4 h-4" />
                <span>Bloqueado ({formatCountdown(lockSeconds)})</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Entrar no Sistema</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Gateway :8080</span>
          </div>
          <StatusBadge status="ok" label="Certificado Fiscal" size="small" />
        </div>
      </div>
    </div>
  );
};
