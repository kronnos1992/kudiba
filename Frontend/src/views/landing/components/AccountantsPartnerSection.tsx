import React from 'react';
import { Award, FileSpreadsheet, CheckCircle2, Users2 } from 'lucide-react';

interface AccountantsPartnerSectionProps {
  onJoinProgram: () => void;
}

export const AccountantsPartnerSection: React.FC<AccountantsPartnerSectionProps> = ({ onJoinProgram }) => {
  return (
    <section id="contabilistas" className="py-16 sm:py-24 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 p-8 sm:p-12 lg:p-16 text-white border border-emerald-900/40 shadow-2xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1.5 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                <Award className="h-4 w-4" />
                <span>Programa de Parceria para Gabinetes e Peritos (OPCA)</span>
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl leading-tight">
                É Contabilista ou Consultor Fiscal? <br />
                <span className="text-amber-300">
                  Gerencie todos os seus clientes num único painel gratuito.
                </span>
              </h2>

              <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                Sabemos o pesadelo que é receber ficheiros SAF-T com erros dos clientes no dia 15 de cada mês. No Kudiba ERP, criámos um portal dedicado para gabinetes de contabilidade:
              </p>

              <div className="mt-6 space-y-3 text-xs sm:text-sm text-slate-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Acesso Gratuito de Auditor:</strong> Consulte lançamentos, extratos e documentos dos seus clientes sem pagar licença de utilizador.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>SAF-T (AO) Validado em 1 Clique:</strong> Elimine rejeições da AGT com o nosso motor de validação sintática e semântica XSD pré-integrado.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Comissionamento e Bonificação:</strong> Receba retorno recorrente por cada cliente que adotar o Kudiba por recomendação do seu gabinete.
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  type="button"
                  onClick={onJoinProgram}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-xs sm:text-sm font-extrabold text-slate-950 hover:bg-emerald-400 active:scale-[0.99] transition shadow-lg shadow-emerald-600/30"
                >
                  <Users2 className="h-4 w-4" />
                  <span>Aderir ao Programa de Parceiros</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-emerald-500/20 bg-slate-900/80 p-6 backdrop-blur-sm">
              <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Portal do Contabilista (Visão Geral)
              </h3>
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-slate-800/80 p-3.5 flex justify-between items-center border border-slate-700/60">
                  <div>
                    <p className="font-bold text-white">Supermercado Aliança, Lda</p>
                    <p className="text-[11px] text-slate-400">NIF 5418290192 • Luanda</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 text-[10px]">
                    SAF-T Válido
                  </span>
                </div>

                <div className="rounded-xl bg-slate-800/80 p-3.5 flex justify-between items-center border border-slate-700/60">
                  <div>
                    <p className="font-bold text-white">Logística & Transportes Kz, SA</p>
                    <p className="text-[11px] text-slate-400">NIF 5001289381 • Benguela</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 text-[10px]">
                    Fecho Pronto
                  </span>
                </div>

                <div className="rounded-xl bg-slate-800/80 p-3.5 flex justify-between items-center border border-slate-700/60">
                  <div>
                    <p className="font-bold text-white">Farmácia Vida Saudável, Lda</p>
                    <p className="text-[11px] text-slate-400">NIF 5491028472 • Huambo</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-bold text-emerald-400 text-[10px]">
                    Balancete 6 Col.
                  </span>
                </div>
              </div>

              <p className="mt-4 text-[11px] text-slate-400 text-center">
                Mude de cliente instantaneamente sem trocar de sessão ou fazer logins manuais.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
