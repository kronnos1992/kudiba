import React from 'react';
import { FileSpreadsheet, CheckCircle2, Users2, Landmark } from 'lucide-react';

interface AccountantsPartnerSectionProps {
  onJoinProgram: () => void;
}

export const AccountantsPartnerSection: React.FC<AccountantsPartnerSectionProps> = ({ onJoinProgram }) => {
  return (
    <section id="contabilistas" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-slate-900 p-8 sm:p-12 lg:p-16 text-white border border-slate-800 shadow-xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
                <Landmark className="h-4 w-4" />
                <span>Parceria para Gabinetes e Peritos Contabilistas (OPCA)</span>
              </div>

              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl leading-tight">
                É Contabilista ou Perito Contabilista? <br />
                <span className="text-emerald-400">
                  Aceda gratuitamente aos dados fiscais dos seus clientes.
                </span>
              </h2>

              <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                O Kudiba ERP disponibiliza uma área exclusiva para gabinetes de contabilidade. Simplifique o fecho mensal e a entrega das obrigações fiscais da AGT sem perdas de tempo.
              </p>

              <div className="mt-6 space-y-3.5 text-xs sm:text-sm text-slate-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Perfil de Auditor Gratuito:</strong> Aceda a extratos, faturas e lançamentos dos seus clientes sem qualquer custo de subscrição para o seu gabinete.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ficheiro SAF-T (AO) Sem Falhas:</strong> Emissão validada contra as regras da AGT, eliminando o retrabalho no portal tributário.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Plano Geral de Contabilidade (PGC):</strong> Mapas contabilísticos, balancetes de 4 e 6 colunas prontos para o fecho do Modelo 1.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={onJoinProgram}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-500 active:scale-[0.99] transition shadow-md"
                >
                  <Users2 className="h-4 w-4" />
                  <span>Aderir ao Programa de Parceiros Kudiba</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-6">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Área de Trabalho do Contabilista
              </h3>
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-slate-900 p-3.5 flex justify-between items-center border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Comércio & Distribuição Luanda, Lda</p>
                    <p className="text-[11px] text-slate-400">NIF 5418290192 • SAF-T Mensal</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-400 text-[10px]">
                    Validado AGT
                  </span>
                </div>

                <div className="rounded-xl bg-slate-900 p-3.5 flex justify-between items-center border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Indústria & Serviços Benguela, SA</p>
                    <p className="text-[11px] text-slate-400">NIF 5001289381 • PGC Classes 0-8</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-400 text-[10px]">
                    Balancete 6 Col.
                  </span>
                </div>

                <div className="rounded-xl bg-slate-900 p-3.5 flex justify-between items-center border border-slate-800">
                  <div>
                    <p className="font-bold text-white">Rede Alimentar Huambo, Lda</p>
                    <p className="text-[11px] text-slate-400">NIF 5491028472 • Folha Salarial</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-400 text-[10px]">
                    IRT & INSS 100%
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-400 text-center">
                Alterne entre empresas clientes com um clique no mesmo portal de auditoria.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
