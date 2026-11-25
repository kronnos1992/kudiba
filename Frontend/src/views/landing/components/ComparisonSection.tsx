import React from 'react';
import { Check, X } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  const comparisonItems = [
    {
      feature: 'Moeda e Risco Cambial',
      legacy: 'Preços indexados a USD ou EUR com disparadas cambiais frequentes.',
      kudiba: 'Preço 100% fixo em Kwanzas (AOA), orçamentação estável e previsível.',
      kudibaBetter: true,
    },
    {
      feature: 'Operação quando a Internet Cai',
      legacy: 'Bloqueio total do balcão ou inconsistência ao voltar a rede.',
      kudiba: 'Local-First nativo: vende, imprime talão e assina offline; sincroniza em lote.',
      kudibaBetter: true,
    },
    {
      feature: 'Licenças Ocultas de Base de Dados',
      legacy: 'Exige Microsoft SQL Server e Windows Server pagos à parte por CPU.',
      kudiba: 'PostgreSQL Linux open-source de alto débito: 0 Kz em licenças de BD.',
      kudibaBetter: true,
    },
    {
      feature: 'Atualizações Fiscais AGT (Decreto 71/25)',
      legacy: 'Consultoria cara por hora e instalação manual de patches.',
      kudiba: 'Atualizações regulatórias automáticas e motor fiscal certificado embutido.',
      kudibaBetter: true,
    },
    {
      feature: 'Validação de Alvarás e Retenção 6.5%',
      legacy: 'Conferência manual externa suscetível a multas da AGT.',
      kudiba: 'Consulta em tempo real SILAC/MINDCOM e cálculo automático de retenção.',
      kudibaBetter: true,
    },
    {
      feature: 'Curva de Aprendizagem da Equipa',
      legacy: '3 a 6 meses de treino técnico com telas densas dos anos 90.',
      kudiba: 'Operador produtivo em 2 horas; interface moderna e atalhos ergonómicos.',
      kudibaBetter: true,
    },
  ];

  return (
    <section id="comparativo" className="py-16 sm:py-24 bg-slate-50/60 dark:bg-slate-900/40 border-y border-slate-200/80 dark:border-slate-800/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Diagnóstico de Mercado
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Por que as empresas em Angola estão a trocar os ERPs legados pelo Kudiba?
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Uma comparação direta entre o modelo tradicional (Primavera, PHC, Sage) e a arquitetura moderna do Kudiba.
          </p>
        </div>

        {/* Comparison Table / Cards */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-12 bg-slate-100/80 p-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <div className="col-span-12 sm:col-span-4">Vetor de Análise</div>
            <div className="col-span-12 sm:col-span-4 mt-2 sm:mt-0 text-slate-500">
              Sistemas Tradicionais (Anos 90)
            </div>
            <div className="col-span-12 sm:col-span-4 mt-2 sm:mt-0 text-emerald-600 dark:text-emerald-400">
              Kudiba ERP (Nova Geração)
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {comparisonItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 p-4 sm:p-5 text-sm items-center hover:bg-slate-50/60 dark:hover:bg-slate-900/50 transition"
              >
                <div className="col-span-12 sm:col-span-4 font-semibold text-slate-900 dark:text-white mb-2 sm:mb-0">
                  {item.feature}
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-start gap-2.5 text-slate-500 dark:text-slate-400 mb-2 sm:mb-0 pr-2">
                  <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{item.legacy}</span>
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-start gap-2.5 font-medium text-slate-900 dark:text-emerald-300">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item.kudiba}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
