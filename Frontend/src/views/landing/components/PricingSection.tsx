import React from 'react';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface PricingSectionProps {
  onSelectPlan: (planName: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      name: 'Kudiba Comercial',
      subtitle: 'Ideal para retalho, lojas de proximidade, oficinas e pequenos comércios.',
      priceAoa: '35.000',
      period: 'Kz / mês',
      billingNote: 'Subscrição anual (420.000 Kz/ano)',
      popular: false,
      terminals: 'Até 3 postos de atendimento',
      features: [
        'Faturação Comercial Certificada AGT (FT, FR, NC, ND, GT)',
        'Ponto de Venda (POS) com emissão e talão térmico 100% offline',
        'QR Code oficial e assinatura digital em conformidade',
        'Gestão de stocks essencial e inventário físico',
        'Abertura, conferência e fecho cego de caixas com TPA',
        'Exportação mensal de SAF-T (AO) v1.01 validado',
        'Apoio técnico remoto assegurado pela equipa Kudiba',
      ],
      buttonText: 'Aderir ao Plano Comercial',
    },
    {
      name: 'Kudiba PME Integrado',
      subtitle: 'A solução mais recomendada para empresas comerciais e de serviços em expansão.',
      priceAoa: '65.000',
      period: 'Kz / mês',
      billingNote: 'Subscrição anual (780.000 Kz/ano)',
      popular: true,
      terminals: 'Até 8 postos / utilizadores',
      features: [
        'Todas as funcionalidades do Plano Comercial',
        'Processamento de Salários com Tabela Oficial IRT 28/20',
        'Apuramento e retenção de Segurança Social (INSS 3% e 8%)',
        'Exportação do ficheiro bancário PS2 (Multicaixa em lote)',
        'Gestão de múltiplos armazéns com conversão de embalagens',
        'Rastreabilidade de lotes com datas de validade (FIFO/FEFO)',
        'Tesouraria integrada, contas bancárias e aging de clientes',
        'Validador de regularidade de alvarás comerciais (SILAC)',
        'Formação inicial da equipa e migração assistida de dados',
      ],
      buttonText: 'Escolher PME Integrado',
    },
    {
      name: 'Kudiba Corporate & Holding',
      subtitle: 'Para grupos empresariais, grandes superfícies e indústrias multi-filial.',
      priceAoa: '120.000',
      period: 'Kz / mês',
      billingNote: 'Subscrição anual ou plano à medida',
      popular: false,
      terminals: 'Postos e utilizadores escaláveis',
      features: [
        'Todas as funcionalidades do Plano PME Integrado',
        'Contabilidade Geral e Analítica completa (PGC Classes 0 a 8)',
        'Balancetes analíticos a 4 e 6 colunas, DRE e Balanço patrimonial',
        'Consolidação multi-empresa e gestão centralizada de filiais',
        'Integrações com sistemas externos através de API corporativa',
        'Ambiente de alta disponibilidade e salvaguarda contínua de dados',
        'Gestor de conta executivo dedicado com SLA prioritário',
        'Implementação presencial e apoio de transição personalizado',
      ],
      buttonText: 'Solicitar Proposta Corporate',
    },
  ];

  return (
    <section id="planos" className="py-16 sm:py-24 bg-slate-50/60 dark:bg-slate-900/40 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Planos Comerciais Transparentes
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Investimento 100% em Kwanzas, sem custos surpresa
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Escolha o plano ajustado à dimensão da sua empresa. Todas as subscrições incluem as atualizações legais da AGT e o suporte técnico especializado.
          </p>
        </div>

        {/* Pricing Cards Grid (Estilo Corporativo SAP / Primavera) */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 items-stretch">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all ${
                p.popular
                  ? 'border-2 border-emerald-800 bg-white shadow-xl shadow-slate-900/5 dark:bg-slate-900 dark:border-emerald-500'
                  : 'border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-800 px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-sm dark:bg-emerald-600">
                  Mais Escolhido em Angola
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {p.name}
                </h3>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">
                  {p.subtitle}
                </p>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">
                    {p.priceAoa}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {p.period}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
                  {p.billingNote}
                </p>

                <div className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {p.terminals}
                </div>

                <ul className="mt-8 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 pt-6 dark:border-slate-800">
                  {p.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectPlan(p.name)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] ${
                    p.popular
                      ? 'bg-emerald-800 text-white shadow-md hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{p.buttonText}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise Assistance Notice */}
        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Precisa de um projeto à medida para grande porte ou rede de retalho?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                A nossa equipa de consultores desenha a arquitetura de implementação para a sua operação em qualquer província de Angola.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectPlan('Projeto À Medida / Grande Porte')}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Falar com a Direção Comercial
          </button>
        </div>
      </div>
    </section>
  );
};
