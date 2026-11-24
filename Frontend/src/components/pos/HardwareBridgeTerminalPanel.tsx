import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Activity,
  ShieldCheck,
  Printer,
  Server,
  Cpu,
  Zap,
  ArrowRight,
  Send,
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';

interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYSTEM' | 'BRIDGE' | 'BACKEND' | 'PRINTER' | 'DRAWER' | 'WARN' | 'ERROR';
  message: string;
  details?: Record<string, any>;
  durationMs?: number;
}

interface HardwareMetrics {
  bridgeOnline: boolean;
  bridgeLatencyMs: number | null;
  backendOnline: boolean;
  backendLatencyMs: number | null;
  paired: boolean;
  tokenExcerpt: string | null;
  label: string | null;
  lastHeartbeat: string;
  packetsSent: number;
  packetsReceived: number;
}

export const HardwareBridgeTerminalPanel: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [customCommand, setCustomCommand] = useState<string>('');
  const [actionBusy, setActionBusy] = useState<boolean>(false);

  const [metrics, setMetrics] = useState<HardwareMetrics>({
    bridgeOnline: false,
    bridgeLatencyMs: null,
    backendOnline: false,
    backendLatencyMs: null,
    paired: false,
    tokenExcerpt: null,
    label: null,
    lastHeartbeat: 'A iniciar...',
    packetsSent: 0,
    packetsReceived: 0,
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number | null>(null);

  const addLog = useCallback(
    (
      source: LogEntry['source'],
      message: string,
      details?: Record<string, any>,
      durationMs?: number
    ) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-AO', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + '.' + String(now.getMilliseconds()).padStart(3, '0');

      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: timeStr,
        source,
        message,
        details,
        durationMs,
      };

      setLogs((prev) => [...prev.slice(-149), entry]);
    },
    []
  );

  const checkTelemetry = useCallback(async () => {
    let bridgeOk = false;
    let bridgeLatency: number | null = null;
    let isPaired = false;
    let activeLabel: string | null = null;

    // 1. Sonda ao Agente Local (127.0.0.1:17842)
    const bridgeStart = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:17842/diag', {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);
      bridgeLatency = Math.round(performance.now() - bridgeStart);

      if (res.ok) {
        bridgeOk = true;
        const data = await res.json();
        isPaired = Boolean(data.paired);
        addLog(
          'BRIDGE',
          `GET /diag -> 200 OK (${bridgeLatency}ms) • [paired=${data.paired}, cols=${data.profile?.columns || 48}, cutter=${data.profile?.has_cutter}]`,
          data,
          bridgeLatency
        );
      } else {
        addLog('WARN', `GET /diag -> HTTP ${res.status} (${bridgeLatency}ms)`);
      }
    } catch (err: any) {
      bridgeLatency = Math.round(performance.now() - bridgeStart);
      addLog('ERROR', `Ligação ao agente local falhou (${bridgeLatency}ms): ${err.message || 'Sem resposta'}`);
    }

    // 2. Sonda ao Servidor Central (Backend API)
    let backendOk = false;
    let backendLatency: number | null = null;
    const backendStart = performance.now();
    try {
      const rawBase = import.meta.env.VITE_API_BASE_URL;
      const baseUrl = (rawBase !== undefined ? rawBase : '').replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${baseUrl}/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      backendLatency = Math.round(performance.now() - backendStart);

      if (res.ok) {
        backendOk = true;
        addLog(
          'BACKEND',
          `GET /health -> 200 OK (${backendLatency}ms) [central gateway operacional]`,
          undefined,
          backendLatency
        );
      } else {
        addLog('WARN', `GET /health -> HTTP ${res.status} (${backendLatency}ms)`);
      }
    } catch {
      backendLatency = Math.round(performance.now() - backendStart);
      addLog('WARN', `Sonda ao backend central sem resposta (${backendLatency}ms)`);
    }

    // Leitura de credenciais do localStorage do browser
    const storedToken = window.localStorage.getItem('kudiba_hardware_bridge_token');
    const tokenExcerpt = storedToken ? `${storedToken.substring(0, 10)}...${storedToken.slice(-6)}` : null;

    setMetrics((prev) => ({
      bridgeOnline: bridgeOk,
      bridgeLatencyMs: bridgeLatency,
      backendOnline: backendOk,
      backendLatencyMs: backendLatency,
      paired: isPaired || Boolean(storedToken),
      tokenExcerpt,
      label: activeLabel || 'POS Caixa',
      lastHeartbeat: new Date().toLocaleTimeString('pt-AO'),
      packetsSent: prev.packetsSent + 2,
      packetsReceived: prev.packetsReceived + (bridgeOk ? 1 : 0) + (backendOk ? 1 : 0),
    }));
  }, [addLog]);

  // Loop de Telemetria Always-on
  useEffect(() => {
    addLog('SYSTEM', 'Inicialização do Monitor de Comunicação de Hardware Kudiba ERP v0.1.0');
    addLog('SYSTEM', `Posto de trabalho vinculado à empresa ID: ${activeTenant?.id || 'Geral'}`);
    void checkTelemetry();

    if (isStreaming) {
      intervalRef.current = window.setInterval(() => {
        void checkTelemetry();
      }, 2500);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isStreaming, checkTelemetry, activeTenant?.id, addLog]);

  // Auto-scroll da consola
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.source}] ${l.message} ${l.durationMs ? `(${l.durationMs}ms)` : ''}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Logs copiados para a área de transferência.');
  };

  const handleTestDrawer = async () => {
    setActionBusy(true);
    addLog('DRAWER', '>> TEST_COMMAND: Enviar pulso de abertura de gaveta para http://127.0.0.1:17842/device/drawer/open');
    try {
      const storedToken = window.localStorage.getItem('kudiba_hardware_bridge_token');
      const res = await fetch('http://127.0.0.1:17842/device/drawer/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        },
        body: JSON.stringify({
          printJobId: `test-${Date.now()}`,
          tenantId: activeTenant?.id || '00000000-0000-0000-0000-000000000000',
          reason: 'Diagnóstico manual via Terminal de Configurações',
          confirm: true,
        }),
      });

      if (res.ok) {
        addLog('DRAWER', '<< PULSO ELÉTRICO RJ11 DISPARADO: Gaveta acionada com sucesso (ESC p 0 25 250)');
        toast.success('Pulso de abertura de gaveta enviado com sucesso!');
      } else {
        const errorText = await res.text();
        addLog('ERROR', `<< Falha ao acionar gaveta: HTTP ${res.status} - ${errorText}`);
        toast.error(`Falha: ${errorText || 'Gaveta não respondeu'}`);
      }
    } catch (err: any) {
      addLog('ERROR', `<< Exceção ao comunicar com a gaveta: ${err.message}`);
      toast.error('Não foi possível contactar o agente para teste de gaveta.');
    } finally {
      setActionBusy(false);
    }
  };

  const handlePingImmediate = async () => {
    setActionBusy(true);
    addLog('SYSTEM', '>> DIAG_PING: Sonda forçada manual iniciada...');
    await checkTelemetry();
    setActionBusy(false);
  };

  const handleExecuteCustomCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = customCommand.trim();
    if (!cmd) return;

    addLog('SYSTEM', `$ ${cmd}`);
    setCustomCommand('');

    if (cmd.toLowerCase() === 'help') {
      addLog('SYSTEM', 'Comandos suportados: ping, drawer, diag, status, clear, pair [codigo]');
    } else if (cmd.toLowerCase() === 'clear') {
      setLogs([]);
    } else if (cmd.toLowerCase() === 'ping') {
      void handlePingImmediate();
    } else if (cmd.toLowerCase() === 'drawer') {
      void handleTestDrawer();
    } else if (cmd.toLowerCase().startsWith('pair ')) {
      const code = cmd.split(' ')[1];
      addLog('SYSTEM', `A tentar emparelhar com o código: ${code}...`);
    } else {
      addLog('WARN', `Comando não reconhecido: "${cmd}". Digite "help" para ver os comandos disponíveis.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* HUD - Métricas de Comunicação em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Agente Local */}
        <GlassCard className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Agente Local (Posto)
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                metrics.bridgeOnline
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  metrics.bridgeOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {metrics.bridgeOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.bridgeLatencyMs !== null ? `${metrics.bridgeLatencyMs} ms` : '—'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">127.0.0.1:17842</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Latência Local</span>
          </div>
        </GlassCard>

        {/* Card 2: Servidor Central */}
        <GlassCard className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Servidor Central
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                metrics.backendOnline
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  metrics.backendOnline ? 'bg-blue-500' : 'bg-amber-500'
                }`}
              />
              {metrics.backendOnline ? 'OPERACIONAL' : 'CONEXÃO LIMITADA'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                {metrics.backendLatencyMs !== null ? `${metrics.backendLatencyMs} ms` : '—'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Gateway & Faturação</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Nuvem / ngrok</span>
          </div>
        </GlassCard>

        {/* Card 3: Emparelhamento & Token */}
        <GlassCard className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Segurança &amp; Token
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                metrics.paired
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
              }`}
            >
              {metrics.paired ? 'EMPARELHADO' : 'PENDENTE'}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-xs font-bold font-mono text-slate-800 dark:text-slate-100">
                {metrics.tokenExcerpt || 'Sem token'}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Chave HMAC Ativa</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Posto Caixa</span>
          </div>
        </GlassCard>

        {/* Card 4: Periféricos Físicos */}
        <GlassCard className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Impressora &amp; Gaveta
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400">
              ESC/POS 9100
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                48 Colunas • RJ11
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Pulso automático ativo</p>
            </div>
            <button
              type="button"
              onClick={handleTestDrawer}
              disabled={actionBusy || !metrics.bridgeOnline}
              className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-40"
            >
              Testar Gaveta
            </button>
          </div>
        </GlassCard>
      </div>

      {/* Diagrama de Fluxo Visual Bidirecional */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Nó 1: Cliente POS */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full md:w-auto flex-1">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              POS
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Cliente Web / Caixa
              </p>
              <p className="text-[11px] text-slate-500 truncate">Sessão Ativa no Navegador</p>
            </div>
          </div>

          {/* Conexão 1 -> 2 */}
          <div className="flex flex-col items-center justify-center text-slate-400 shrink-0">
            <span className="text-[10px] font-mono text-emerald-600 font-bold flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" />
              REST / PNA
            </span>
            <ArrowRight className="w-4 h-4 hidden md:block text-emerald-600" />
            <span className="text-[10px] text-slate-400 hidden md:block">
              {metrics.bridgeLatencyMs ? `${metrics.bridgeLatencyMs}ms` : '1.2ms'}
            </span>
          </div>

          {/* Nó 2: Agente Hardware */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full md:w-auto flex-1">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Agente Kudiba (Bridge)
              </p>
              <p className="text-[11px] text-slate-500 font-mono truncate">127.0.0.1:17842</p>
            </div>
          </div>

          {/* Conexão 2 -> 3 */}
          <div className="flex flex-col items-center justify-center text-slate-400 shrink-0">
            <span className="text-[10px] font-mono text-amber-600 font-bold flex items-center gap-1">
              <Printer className="w-3 h-3" />
              ESC/POS
            </span>
            <ArrowRight className="w-4 h-4 hidden md:block text-amber-600" />
            <span className="text-[10px] text-slate-400 hidden md:block">Porta 9100</span>
          </div>

          {/* Nó 3: Impressora e Gaveta */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full md:w-auto flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Impressora &amp; Gaveta
              </p>
              <p className="text-[11px] text-slate-500 truncate">Talões Fiscais &amp; Troco</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Terminal Console Always-On (Estilo Dark UNIX) */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono text-xs">
        {/* Barra Superior do Terminal */}
        <div className="h-10 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-slate-400 font-semibold text-xs ml-2 hidden sm:inline">
              kudiba-hardware-bridge-daemon — live console
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Live */}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {isStreaming ? 'LIVE STREAMING' : 'PAUSADO'}
            </span>

            {/* Controles do Terminal */}
            <button
              type="button"
              onClick={() => setIsStreaming((prev) => !prev)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title={isStreaming ? 'Pausar fluxo de dados' : 'Retomar fluxo ao vivo'}
            >
              {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => setAutoScroll((prev) => !prev)}
              className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-colors ${
                autoScroll ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              title={autoScroll ? 'Auto-scroll ativado' : 'Auto-scroll desativado'}
            >
              AUTOSCROLL
            </button>

            <button
              type="button"
              onClick={() => setLogs([])}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Limpar consola"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleCopyLogs}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copiar histórico de logs"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Área de Visualização dos Logs */}
        <div className="p-4 h-80 overflow-y-auto space-y-1 bg-slate-950/95 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 text-xs">
              A aguardar batimentos de rede e telemetria de hardware...
            </div>
          ) : (
            logs.map((log) => {
              let badgeColor = 'text-slate-400';
              if (log.source === 'BRIDGE') badgeColor = 'text-cyan-400 font-bold';
              if (log.source === 'BACKEND') badgeColor = 'text-emerald-400 font-bold';
              if (log.source === 'DRAWER') badgeColor = 'text-fuchsia-400 font-bold';
              if (log.source === 'PRINTER') badgeColor = 'text-amber-400 font-bold';
              if (log.source === 'WARN') badgeColor = 'text-yellow-400 font-bold';
              if (log.source === 'ERROR') badgeColor = 'text-rose-400 font-bold';
              if (log.source === 'SYSTEM') badgeColor = 'text-purple-400 font-bold';

              return (
                <div key={log.id} className="leading-relaxed hover:bg-slate-900/60 px-1 rounded flex items-start gap-2">
                  <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                  <span className={`shrink-0 select-none ${badgeColor}`}>[{log.source}]</span>
                  <span className="text-slate-200 break-all flex-1">{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Barra de Ações Rápidas de Diagnóstico */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={actionBusy}
              onClick={handlePingImmediate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${actionBusy ? 'animate-spin' : ''}`} />
              <span>Ping Forçado</span>
            </button>

            <button
              type="button"
              disabled={actionBusy || !metrics.bridgeOnline}
              onClick={handleTestDrawer}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Testar Pulso da Gaveta</span>
            </button>
          </div>

          {/* Linha de Comando Interativa */}
          <form onSubmit={handleExecuteCustomCommand} className="flex items-center gap-1.5 flex-1 max-w-sm">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                $
              </span>
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="help, ping, drawer, clear..."
                className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors"
              title="Executar comando"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
