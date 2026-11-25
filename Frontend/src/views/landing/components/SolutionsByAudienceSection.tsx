import React from 'react';
import { ArrowRight, Building2, Check, FileSpreadsheet, Store } from 'lucide-react';
import type { LandingModuleId } from './FeaturesShowcaseSection';

interface SolutionsByAudienceSectionProps {
  onSelectModule: (id: LandingModuleId) => void;
  onOpenDemo: () => void;
}

const audiences = [
  {
    badge: 'Pequenas Empresas',
    title: 'Comércio Kudiba',
    icon: Store,
    description: 'Para lojas de proximidade, oficinas e pequenos negócios que precisam de faturar em conformidade sem depender de servidores caros.',
    features: ['Faturação certificada AGT', 'POS com venda offline', 'Stocks essenciais', 'SAF-T (AO) mensal'],
    module: 'invoicing' as LandingModuleId,
  },
  {
    badge: 'Médias e Grandes Empresas',
    title: 'Kudiba Integrado',
    icon: Building2,
    description: 'Para operações em crescimento que exigem integração entre vendas, armazéns, salários, tesouraria e informação de gestão.',
    features: ['Multi-armazéns e CMP', 'Folha salarial IRT/INSS', 'Tesouraria e bancos', 'Visão consolidada por filial'],
    module: 'multi' as LandingModuleId,
  },
  {
    badge: 'Escritórios de Contabilidade',
    title: 'Kudiba para Contabilistas',
    icon: FileSpreadsheet,
    description: 'Para gabinetes que acompanham vários clientes e precisam de informação fiscal e contabilística pronta para o fecho mensal.',
    features: ['Perfil de auditor gratuito', 'SAF-T validado pela AGT', 'Balancetes 4 e 6 colunas', 'Mapas do Modelo 1'],
    module: 'accounting' as LandingModuleId,
  },
];

const sectors = ['Retalho', 'Restauração', 'Indústria', 'Serviços', 'Construção', 'Logística', 'Saúde', 'Educação'];

export const SolutionsByAudienceSection: React.FC<SolutionsByAudienceSectionProps> = ({ onSelectModule, onOpenDemo }) => {
  return (
    <section className="border-b border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950 sm:py-20">
      <div className="landing-container">
        <div className="max-w-3xl">
          <span className="landing-eyebrow">Soluções por perfil</span>
          <h2 className="landing-title">Uma solução para cada realidade empresarial</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
            Do balcão de uma loja de bairro à consolidação de um grupo com várias filiais, o Kudiba acompanha a sua empresa em cada fase de crescimento.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <article key={audience.title} className="landing-card flex flex-col p-6 transition hover:border-kudiba-primary dark:hover:border-emerald-500">
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-kudiba-primary dark:bg-emerald-950/50 dark:text-emerald-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{audience.badge}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{audience.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{audience.description}</p>
                <ul className="mt-5 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {audience.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 shrink-0 text-kudiba-primary dark:text-emerald-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => onSelectModule(audience.module)}
                  className="landing-text-link mt-6 border-t border-slate-200 pt-4 dark:border-slate-800"
                >
                  Conhecer a solução <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Setores atendidos</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sectors.map((sector) => (
                <span
                  key={sector}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onOpenDemo} className="landing-btn-outline shrink-0 text-xs">
            Falar com um consultor <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
