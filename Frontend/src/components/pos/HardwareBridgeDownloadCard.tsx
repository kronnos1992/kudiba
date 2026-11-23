import React, { useState } from 'react';
import {
  Download,
  Terminal,
  CheckCircle2,
  Printer,
  Cpu,
  HardDrive,
  Copy,
  Check,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { GlassCard } from '../common/GlassCard';

export type SupportedOS = 'windows' | 'linux' | 'macos';

interface OSDownloadInfo {
  id: SupportedOS;
  name: string;
  badge: string;
  description: string;
  filename: string;
  url: string;
  size: string;
  format: string;
  steps: string[];
  command?: string;
}

const OS_OPTIONS: Record<SupportedOS, OSDownloadInfo> = {
  windows: {
    id: 'windows',
    name: 'Windows',
    badge: '64 bits (Recomendado)',
    description: 'Compatível com Windows 10, Windows 11 e Windows Server (x64).',
    filename: 'kudiba-hardware-bridge-windows-x64.zip',
    url: '/downloads/hardware-bridge/kudiba-hardware-bridge-windows-x64.zip',
    size: '2.6 KB (Pacote Inicial)',
    format: '.ZIP',
    steps: [
      'Descarregue e extraia o pacote ZIP no computador do posto de caixa.',
      'Dê um duplo clique no ficheiro "iniciar-agente.bat".',
      'Uma janela de terminal abrirá com o código de 6 dígitos para emparelhar com o Kudiba POS.',
      'Para arranque automático com o Windows, execute "instalar-servico-windows.bat" como Administrador.',
    ],
    command: 'iniciar-agente.bat',
  },
  linux: {
    id: 'linux',
    name: 'Linux',
    badge: 'Binário Nativo x64',
    description: 'Compatível com Ubuntu, Debian, RedHat, Fedora e distribuições Linux x64.',
    filename: 'kudiba-hardware-bridge-linux-x64.tar.gz',
    url: '/downloads/hardware-bridge/kudiba-hardware-bridge-linux-x64.tar.gz',
    size: '2.0 MB (Binário Nativo)',
    format: '.TAR.GZ',
    steps: [
      'Descarregue e extraia o arquivo tar.gz no terminal: tar -xzf kudiba-hardware-bridge-linux-x64.tar.gz',
      'Entre na pasta e execute: ./iniciar-agente.sh',
      'Copie o código de 6 dígitos gerado e insira no POS para emparelhar.',
      'Para serviço systemd de segundo plano, consulte o ficheiro kudiba-hardware-bridge.service incluído.',
    ],
    command: 'tar -xzf kudiba-hardware-bridge-linux-x64.tar.gz && cd kudiba-hardware-bridge-linux && ./iniciar-agente.sh',
  },
  macos: {
    id: 'macos',
    name: 'macOS',
    badge: 'Apple Silicon & Intel',
    description: 'Compatível com macOS Monterey, Ventura, Sonoma e Sequoia.',
    filename: 'kudiba-hardware-bridge-macos.tar.gz',
    url: '/downloads/hardware-bridge/kudiba-hardware-bridge-macos.tar.gz',
    size: '870 Bytes',
    format: '.TAR.GZ',
    steps: [
      'Descarregue e descompacte o arquivo no seu Mac.',
      'Abra o Terminal e execute o script "iniciar-agente.command".',
      'O código de emparelhamento de 6 caracteres será exibido para registar no POS.',
      'Suporta impressoras térmicas conectadas via TCP/IP na porta 9100 ou USB.',
    ],
    command: 'tar -xzf kudiba-hardware-bridge-macos.tar.gz && ./kudiba-hardware-bridge-macos/iniciar-agente.command',
  },
};

export const HardwareBridgeDownloadCard: React.FC<{ defaultOs?: SupportedOS; className?: string }> = ({
  defaultOs = 'windows',
  className = '',
}) => {
  const [selectedOs, setSelectedOs] = useState<SupportedOS>(defaultOs);
  const [copied, setCopied] = useState(false);

  const currentPackage = OS_OPTIONS[selectedOs];

  const handleCopyCommand = () => {
    if (!currentPackage.command) return;
    navigator.clipboard.writeText(currentPackage.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <GlassCard className={`p-5 sm:p-6 space-y-6 ${className}`}>
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Agente Local Kudiba (Hardware Bridge)
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                v0.1.0 Estável
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Serviço de alta velocidade para comunicação direta com impressoras térmicas (ESC/POS 58mm/80mm) e abertura automática de gavetas de dinheiro no posto POS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Porta Local: 17842</span>
          </div>
        </div>
      </div>

      {/* Seletor de Sistema Operacional */}
      <div className="space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          1. Selecione o Sistema Operacional do Posto de Caixa
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.keys(OS_OPTIONS) as SupportedOS[]).map((osKey) => {
            const os = OS_OPTIONS[osKey];
            const isSelected = selectedOs === osKey;
            return (
              <button
                key={osKey}
                type="button"
                onClick={() => setSelectedOs(osKey)}
                className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {osKey === 'windows' && (
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-xs">
                        WIN
                      </div>
                    )}
                    {osKey === 'linux' && (
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs">
                        TUX
                      </div>
                    )}
                    {osKey === 'macos' && (
                      <div className="w-8 h-8 rounded-xl bg-slate-500/10 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                        MAC
                      </div>
                    )}
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {os.name}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {os.badge}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {os.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloco de Download e Ação */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900 dark:to-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                {currentPackage.filename}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                {currentPackage.format}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tamanho do ficheiro: <strong className="text-slate-700 dark:text-slate-200">{currentPackage.size}</strong> • Assinatura Criptográfica RSA
            </p>
          </div>

          <a
            href={currentPackage.url}
            download={currentPackage.filename}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/25 transition-all duration-150 cursor-pointer text-center shrink-0 active:scale-98"
          >
            <Download className="w-5 h-5" />
            <span>Descarregar para {currentPackage.name}</span>
          </a>
        </div>

        {/* Linha de comando rápida */}
        {currentPackage.command && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                Comando rápido de extração/execução:
              </span>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copiado!' : 'Copiar comando'}</span>
              </button>
            </div>
            <pre className="p-2.5 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap select-all">
              {currentPackage.command}
            </pre>
          </div>
        )}
      </div>

      {/* Instruções passo a passo */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          Como Configurar em 4 Passos Simples
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {currentPackage.steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800"
            >
              <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-extrabold text-[11px] shrink-0">
                {idx + 1}
              </span>
              <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Destaque de Segurança e Protocolos */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Emparelhamento com código temporário anti-fraude (desafio com expiração em 5 minutos).
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 font-medium text-[11px]">
          <span>Impressoras: ESC/POS (9100 / USB)</span>
          <span>•</span>
          <span>Gaveta: RJ11/RJ12</span>
        </div>
      </div>
    </GlassCard>
  );
};
