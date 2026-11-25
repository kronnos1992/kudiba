import React from 'react';
import { Check, X } from 'lucide-react';

export const ComparisonSection: React.FC = () => {
  const comparisonItems = [
    {
      criteria: 'Estabilidade Cambial e Orçamento',
      traditional: 'Faturação indexada ao Dólar ou Euro, encarecendo a cada oscilação cambial.',
      kudiba: 'Contrato 100% em Kwanzas (AOA). Previsibilidade anual garantida para o seu fluxo de caixa.',
    },
    {
      criteria: 'Continuidade de Venda no Balcão',
      traditional: 'Queda de internet ou sinal instável paralisa os caixas e gera filas no balcão.',
      kudiba: 'O Ponto de Venda emite faturas e imprime talões mesmo offline, sincronizando em lote ao restabelecer a rede.',
    },
    {
      criteria: 'Custo de Infraestrutura & Base de Dados',
      traditional: 'Exigência de servidores dispendiosos com licenças Microsoft Windows e SQL Server cobradas à parte.',
      kudiba: 'Sem licenças ocultas de base de dados. Solução leve que opera nos equipamentos existentes da sua empresa.',
    },
    {
      criteria: 'Apoio e Implementação em Angola',
      traditional: 'Atendimento demorado através de parceiros intermediários com fuso horário distante.',
      kudiba: 'Apoio direto de proximidade com equipa técnica local em Luanda e nas províncias.',
    },
    {
      criteria: 'Conformidade Fiscal e Regras da AGT',
      traditional: 'Atualizações fiscais morosas com custos extras de consultoria técnica por hora.',
      kudiba: 'Conformidade fiscal contínua (Decreto 71/25 e SAF-T AO) integrada na própria subscrição.',
    },
  ];

  return (
    <section id="vantagens" className="py-16 sm:py-24 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Decisão Estratégica
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Porquê escolher o Kudiba ERP para a sua empresa?
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Comparativo transparente entre o modelo convencional e a nova geração de gestão empresarial Kudiba.
          </p>
        </div>

        {/* Corporate Comparison Matrix */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-12 bg-slate-100 p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <div className="col-span-12 sm:col-span-4">Critério de Negócio</div>
            <div className="col-span-12 sm:col-span-4 mt-2 sm:mt-0 text-slate-500">
              Softwares Tradicionais
            </div>
            <div className="col-span-12 sm:col-span-4 mt-2 sm:mt-0 text-emerald-800 dark:text-emerald-400 font-extrabold">
              Kudiba ERP
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {comparisonItems.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 p-5 text-sm items-center hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition"
              >
                <div className="col-span-12 sm:col-span-4 font-bold text-slate-900 dark:text-white mb-2 sm:mb-0">
                  {item.criteria}
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-start gap-2.5 text-slate-500 dark:text-slate-400 mb-2 sm:mb-0 pr-4">
                  <X className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm">{item.traditional}</span>
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-start gap-2.5 font-medium text-slate-900 dark:text-emerald-300">
                  <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm">{item.kudiba}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
