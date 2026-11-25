import React from 'react';
import { ShieldCheck, FileCheck, QrCode, CheckCircle2, Award, Landmark } from 'lucide-react';

export const AgtComplianceSection: React.FC = () => {
  return (
    <section id="conformidade-agt" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Left: Text & Fiscal Framework */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-500/30 dark:text-emerald-300">
              <Landmark className="h-4 w-4" />
              <span>República de Angola · Ministério das Finanças / AGT</span>
            </div>

            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Conformidade Fiscal Total e Certificação Homologada
            </h2>

            <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Desenvolvido de raiz para assegurar conformidade estrita com o <strong>Decreto Presidencial n.º 71/25</strong> e o Decreto Executivo n.º 385/20 da Administração Geral Tributária. A sua empresa opera com segurança jurídica e auditoria transparente em todas as operações.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Assinatura Digital em Tempo Real</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Assinatura criptográfica encadeada em cada documento emitido com impressão dos 4 caracteres de controlo obrigatórios.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <QrCode className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>QR Code Fiscal Oficial</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Emissão padronizada do QR Code em faturas A4 institucionais e em talões térmicos de caixa (80mm).
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <FileCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Exportação SAF-T (AO) v1.01</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Ficheiro mensal de auditoria tributária validado diretamente contra as regras técnicas da AGT, sem risco de rejeição.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <Award className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Consulta de Alvarás Comerciais</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Verificação da regularidade de fornecedores (SILAC/MINDCOM) para salvaguardar a dedutibilidade no Imposto Industrial.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Institutional Seal Card */}
          <div className="lg:col-span-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                    Certificado de Homologação
                  </span>
                  <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                    FE/528/AGT/2026
                  </h3>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md">
                  <ShieldCheck className="h-8 w-8" />
                </div>
              </div>

              <div className="mt-6 space-y-3 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500">Autoridade Tributária:</span>
                  <span className="font-bold text-slate-900 dark:text-white">AGT (República de Angola)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500">Decreto Aplicável:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Decreto Presidencial n.º 71/25</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500">Plano Contabilístico:</span>
                  <span className="font-bold text-slate-900 dark:text-white">PGC Angolano (Decreto 82/01)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500">Legislação Laboral:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Lei n.º 12/23 & IRT 28/20</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Sistema Homologado:</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-400">Kudiba ERP</span>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white p-4 border border-slate-200 text-xs text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 inline mr-1.5 -mt-0.5" />
                <span>Atualizações legislativas incluídas de forma contínua na subscrição.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
