import React from 'react';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';

interface PricingSectionProps {
  onSelectPlan: (planName: string) => void;
}

export const PricingSection: React.FC<PricingSectionProps> = ({ onSelectPlan }) => {
  const plans = [
    {
      name: 'Kudiba Comercial',
      subtitle: 'Para retalho, pequenos mercados, oficinas e prestadores de serviços.',
      priceAoa: '35.000',
      period: 'Kz / mês',
      billingNote: 'Faturado anualmente (420.000 Kz/ano)',
      popular: false,
      terminals: 'Até 3 postos / utilizadores',
      features: [
        'Faturação Comercial Certificada AGT (FT, FR, NC, ND, GT)',
        'Ponto de Venda (POS) Balcão com operação 100% Offline',
        'Impressão térmica de 80mm com QR Code oficial e 4 caracteres',
        'Gestão de stocks essencial e inventário físico',
        'Abertura, sangrias e fecho cego de caixas com apuramento',
        'Exportação mensal de SAF-T (AO) v1.01_01',
        'Suporte técnico remoto em horário comercial',
      ],
      buttonText: 'Escolher Comercial',
      buttonVariant: 'secondary',
    },
    {
      name: 'Kudiba PME Integrado',
      subtitle: 'O plano mais escolhido por pequenas e médias empresas em crescimento.',
      priceAoa: '65.000',
      period: 'Kz / mês',
      billingNote: 'Faturado anualmente (780.000 Kz/ano)',
      popular: true,
      terminals: 'Até 8 postos / utilizadores',
      features: [
        'Tudo incluído no Plano Comercial',
        'Recursos Humanos & Salários com Tabela Oficial IRT 2026',
        'Apuramento de Segurança Social (3% trabalhador + 8% patronal)',
        'Exportação de ficheiro bancário PS2 (Multicaixa em lote)',
        'Gestão avançada de armazéns e conversão de embalagens (UoM)',
        'Rastreio de lotes com validade (regras FIFO/FEFO)',
        'Tesouraria avançada com contas bancárias e aging de clientes',
        'Verificador de Alvarás Comerciais (SILAC/MINDCOM)',
        'Suporte prioritário e formação inicial da equipa',
      ],
      buttonText: 'Escolher PME Integrado',
      buttonVariant: 'primary',
    },
    {
      name: 'Kudiba Corporate',
      subtitle: 'Para grupos empresariais, grandes superfícies e indústrias multi-filial.',
      priceAoa: '120.000',
      period: 'Kz / mês',
      billingNote: 'Faturado anualmente ou sob medida',
      popular: false,
      terminals: 'Utilizadores e postos escaláveis',
      features: [
        'Tudo incluído no Plano PME Integrado',
        'Contabilidade Geral e Analítica completa (PGC Classes 1 a 8)',
        'Lançamentos em partidas dobradas automáticos e Modelo 1',
        'Balancetes a 2, 4 e 6 colunas emitidos instantaneamente',
        'Múltiplas empresas e filiais consolidadas num único painel',
        'API aberta REST e Webhooks para integrações de terceiros',
        'Base de dados isolada dedicada de alto débito',
        'Gestor de conta dedicado com SLA de resposta em 2 horas',
        'Migração assistida integral de dados do Primavera ou PHC',
      ],
      buttonText: 'Falar com Consultor Corporate',
      buttonVariant: 'secondary',
    },
  ];

  return (
    <section id="planos" className="py-16 sm:py-24 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Transparência Sem Surpresas Cambiais
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Planos simples com preços 100% em Kwanzas
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Sem custos escondidos de base de dados, sem licenças em Dólares ou Euros e com todas as atualizações fiscais da AGT incluídas.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 items-stretch">
          {plans.map((p, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col justify-between rounded-3xl border p-7 sm:p-8 transition-all ${
                p.popular
                  ? 'border-2 border-emerald-500 bg-white shadow-xl shadow-emerald-950/10 dark:bg-slate-900 dark:border-emerald-400'
                  : 'border-slate-200 bg-white/80 shadow-sm dark:border-slate-800 dark:bg-slate-950'
              }`}
            >
              {p.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-white shadow-md">
                  Mais Popular em Angola
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {p.name}
                </h3>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 min-h-[32px]">
                  {p.subtitle}
                </p>

                {/* Price Display */}
                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-slate-900 dark:text-white font-mono">
                    {p.priceAoa}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {p.period}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {p.billingNote}
                </p>

                <div className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {p.terminals}
                </div>

                {/* Features List */}
                <ul className="mt-8 space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 pt-6 dark:border-slate-800">
                  {p.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onSelectPlan(p.name)}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition active:scale-[0.99] ${
                    p.popular
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-700/25 hover:bg-emerald-700'
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

        {/* Guarantee Banner */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Precisa de um plano customizado para mais de 30 postos ou rede de franquias?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Oferecemos arquitetura dedicada, replicação multi-servidor e implementação assistida localmente em qualquer província.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectPlan('Customizado / Grandes Redes')}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            Contactar Equipa Técnica
          </button>
        </div>
      </div>
    </section>
  );
};
