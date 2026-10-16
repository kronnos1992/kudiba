import React from 'react';
import { Key, Download } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Configurações Fiscais, Certificação &amp; SAF-T (AO)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Gestão de chaves criptográficas RSA-2048, registo de produtor de software e exportação XML
        </p>
      </div>

      <div className="space-y-4">
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <Key className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Chave Privada RSA-2048 (Assinatura AGT)
              </h3>
            </div>
            <StatusBadge status="ok" label="Chave Ativa &amp; Conforme" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            Versão da Chave: 1 • Algoritmo: SHA1withRSA conforme requisitos técnicos da AGT
          </p>
          <div className="font-mono text-xs p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Chave Pública registada no portal da AGT para verificação do ficheiro SAF-T.
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Exportação do Ficheiro SAF-T (AO) Mensal
            </h3>
            <button
              onClick={() => alert('Download do ficheiro SAF-T AO 2026 XML iniciado.')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-sm font-bold transition-all shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Exportar XML AGT</span>
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Estrutura XML em conformidade com o Decreto Presidencial 385/20 e validações do motor fiscal Kudiba.
          </p>
        </GlassCard>
      </div>
    </div>
  );
};
