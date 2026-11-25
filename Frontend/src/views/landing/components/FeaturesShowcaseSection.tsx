import React from 'react';
import {
  Receipt,
  Boxes,
  Calculator,
  Users,
  Building2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export type LandingModuleId = 'invoicing' | 'accounting' | 'inventory' | 'payroll' | 'multi';

interface FeaturesShowcaseSectionProps {
  activeTab: LandingModuleId;
  onSelectTab: (id: LandingModuleId) => void;
}

export const FeaturesShowcaseSection: React.FC<FeaturesShowcaseSectionProps> = ({ activeTab, onSelectTab }) => {
  const modules = [
    {
      id: 'invoicing' as const,
      label: 'Faturação & POS',
      icon: Receipt,
      category: 'Comercial & Vendas',
      title: 'Faturação Comercial & POS com Rigor Fiscal Total',
      desc: 'Emita faturas, faturas-recibo, notas de crédito e guias de transporte com assinatura digital em tempo real e QR Code oficial. No balcão, a sua operação continua a vender e a imprimir talões mesmo se a ligação à internet falhar.',
      bullets: [
        'Assinatura digital RSA-2048 em tempo real e QR Code fiscal oficial obrigatório',
        'Ponto de Venda (POS) resiliente: vende e imprime talões térmicos offline, sincronizando em lote',
        'Retenção na fonte de 6.5% calculada automaticamente em serviços sujeitos',
        'Exportação direta do ficheiro SAF-T (AO) v1.01_01 validado segundo as normas fiscais',
      ],
      legalRef: 'Conformidade: Decreto Presidencial n.º 71/25 e Decreto Executivo n.º 385/20',
      stats: [
        { label: 'Emissão Offline', value: '100% Funcional' },
        { label: 'Validação Fiscal', value: 'SAF-T (AO) 1.01' },
        { label: 'Impressão', value: 'Talão 80mm e A4' },
      ],
    },
    {
      id: 'accounting' as const,
      label: 'Contabilidade',
      icon: Calculator,
      category: 'Finanças & Gestão',
      title: 'Contabilidade Geral e Analítica segundo o PGC Angolano',
      desc: 'Adequado ao Decreto n.º 82/01, integrando todas as Classes de 0 a 8 em partidas dobradas automáticas. Elimine semanas de conferência manual para fecho do exercício e emissão das declarações oficiais.',
      bullets: [
        'Plano de contas oficial angolano pré-parametrizado (Classes 0 a 8)',
        'Balancetes de verificação emitidos a 4 e 6 colunas em segundos',
        'Demonstração de Resultados (DRE), Demonstração de Fluxos de Caixa (DFC) e Balanço Patrimonial',
        'Preparação dos mapas de suporte para o Modelo 1 do Imposto Industrial',
      ],
      legalRef: 'Enquadramento: Decreto n.º 82/01 (Plano Geral de Contabilidade de Angola)',
      stats: [
        { label: 'Plano de Contas', value: 'Classes 0 a 8' },
        { label: 'Balancetes', value: '4 e 6 Colunas' },
        { label: 'Lançamentos', value: 'Partidas Dobradas' },
      ],
    },
    {
      id: 'inventory' as const,
      label: 'Stocks & Armazéns',
      icon: Boxes,
      category: 'Logística & Suprimentos',
      title: 'Gestão de Stocks, Custo Médio Ponderado (CMP) e Lotes',
      desc: 'Visão exata dos seus ativos em stock. Controle múltiplos armazéns centrais e lojas, faça conversões automáticas de embalagens (contentores para caixas e unidades) e rastreie datas de validade com alertas antecipados.',
      bullets: [
        'Valorização do stock a Custo Médio Ponderado (CMP) em tempo real',
        'Gestão multi-armazéns com transferências e guias de transporte internas',
        'Rastreabilidade rigorosa de lotes e controlo de prazos de validade (FIFO / FEFO)',
        'Baixas automáticas de stock integradas às vendas da faturação e do POS',
      ],
      legalRef: 'Gestão Patrimonial e Logística de Alto Desempenho',
      stats: [
        { label: 'Custeio', value: 'CMP em tempo real' },
        { label: 'Lotes e Validade', value: 'Regras FIFO / FEFO' },
        { label: 'Armazéns', value: 'Multi-localização' },
      ],
    },
    {
      id: 'payroll' as const,
      label: 'Salários, IRT & INSS',
      icon: Users,
      category: 'Recursos Humanos',
      title: 'Folha Salarial em Conformidade com a Lei Geral do Trabalho 12/23',
      desc: 'Processe os vencimentos da sua equipa com rigor. Aplicação rigorosa dos escalões de IRT 28/20, apuramento dos encargos de Segurança Social (3% trabalhador e 8% entidade patronal) e geração do ficheiro de transferências bancárias em lote.',
      bullets: [
        'Tabela progressiva oficial de IRT e enquadramento de subsídios de alimentação e transporte',
        'Cálculo e retenção automática de INSS: 3% encargo laboral e 8% encargo patronal',
        'Exportação do ficheiro bancário PS2 (Multicaixa) para pagamentos em lote sem erros',
        'Recibos de vencimento emitidos em formato institucional para cada colaborador',
      ],
      legalRef: 'Legislação: Lei Geral do Trabalho n.º 12/23 e Tabela de IRT n.º 28/20',
      stats: [
        { label: 'Legislação', value: 'Lei 12/23' },
        { label: 'Segurança Social', value: '3% + 8% Automático' },
        { label: 'Ficheiro Bancário', value: 'PS2 Multicaixa' },
      ],
    },
    {
      id: 'multi' as const,
      label: 'Multi-Filial & Holding',
      icon: Building2,
      category: 'Estrutura Empresarial',
      title: 'Controlo Centralizado de Lojas, Empresas e Filiais',
      desc: 'Ideal para grupos económicos em expansão. Administre diferentes sucursais com séries de faturação independentes e consolide a informação de vendas, tesouraria e stock numa visão executiva única.',
      bullets: [
        'Séries documentais exclusivas por loja ou filial em conformidade fiscal',
        'Permissões de utilizador por filial ou com acesso consolidado de auditor',
        'Visão em tempo real do volume de faturação e liquidez de todo o grupo',
        'Relatórios consolidados para a administração e órgãos sociais',
      ],
      legalRef: 'Solução Escalável para PMEs, Médias Empresas e Grupos Económicos',
      stats: [
        { label: 'Filiais e Lojas', value: 'Consolidação total' },
        { label: 'Séries Fiscais', value: 'Autónomas por loja' },
        { label: 'Acesso Executivo', value: 'Visão Holding' },
      ],
    },
  ];

  const current = modules.find((m) => m.id === activeTab) || modules[0];

  return (
    <section id="solucoes" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="landing-eyebrow">
            Soluções Integradas Kudiba
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Uma plataforma completa para gerir cada área da sua empresa
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Concebida para simplificar o dia a dia da equipa e fornecer à administração dados fiáveis para tomada de decisão.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mt-10 flex flex-wrap gap-2.5 border-b border-slate-200 pb-4 dark:border-slate-800">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const isSelected = activeTab === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onSelectTab(mod.id)}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs sm:text-sm font-bold transition ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-emerald-700'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panel */}
        <div className="mt-8 rounded-lg border border-slate-200/90 bg-slate-50/50 p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            {/* Description */}
            <div className="lg:col-span-7">
              <span className="landing-eyebrow">
                {current.category}
              </span>
              <h3 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {current.title}
              </h3>
              <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {current.desc}
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-200">
                {current.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {current.legalRef}
                </span>
              </div>
            </div>

            {/* Quick Metrics & Highlights Box */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Indicadores de Eficiência
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {current.stats.map((st, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {st.label}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {st.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4 border border-slate-200/80 text-xs text-slate-600 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-white mb-1">
                  Implementação Rápida & Formação
                </p>
                <p>
                  A nossa equipa técnica realiza a migração dos seus dados (artigos, clientes e saldos) e forma os seus operadores em 48 horas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
