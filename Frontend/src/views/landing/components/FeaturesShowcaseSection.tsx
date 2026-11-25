import React, { useState } from 'react';
import {
  Receipt,
  Boxes,
  Calculator,
  Users,
  Wallet,
  WifiOff,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const FeaturesShowcaseSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pos' | 'invoicing' | 'inventory' | 'treasury' | 'payroll' | 'accounting'>('pos');

  const modules = [
    {
      id: 'pos' as const,
      label: 'POS Balcão',
      icon: WifiOff,
      badge: 'Local-First Resiliente',
      title: 'Ponto de Venda Offline que Nunca Trava o Atendimento',
      desc: 'Desenhado para o ritmo intenso do retalho e restauração em Angola. Vende sem internet, comunica com leitores de código de barras, gavetas e impressoras térmicas ESC/POS de 80mm com emissão em menos de 1 segundo.',
      bullets: [
        'Funcionamento 100% offline com sincronização automática em lote assim que a rede estabiliza',
        'Atalhos de teclado ultra-rápidos (F2 para artigos, F4 para quantidade, F9 para pagamento e fecho)',
        'Fecho cego de caixas com apuramento rigoroso de quebras, sobras e reconciliação com TPA',
        'Impressão térmica rápida com 4 caracteres criptográficos e QR Code da AGT',
      ],
      previewStats: [
        { label: 'Tempo de Emissão', val: '< 1 segundo' },
        { label: 'Tolerância a Falhas', val: '100% Offline' },
        { label: 'Formatos Suportados', val: '80mm / 58mm / A4' },
      ],
    },
    {
      id: 'invoicing' as const,
      label: 'Faturação AGT',
      icon: Receipt,
      badge: 'Certificação Oficial',
      title: 'Motor Fiscal Homologado com Decreto Presidencial 71/25',
      desc: 'Emissão de todos os documentos fiscais angolanos com assinatura encadeada RSA-2048, SHA-256 e exportação de SAF-T (AO) 1.01 validado diretamente contra o XSD da AGT.',
      bullets: [
        'Emissão de Faturas (FT), Faturas-Recibo (FR), Notas de Crédito (NC), Débito (ND) e Guias de Transporte (GT)',
        'Retenção na fonte de 6.5% calculada e deduzida automaticamente na prestação de serviços',
        'Suporte a Regime Geral (14%), Regime Simplificado e Isenções fiscais oficiais (M00-M99)',
        'Exportação instantânea de SAF-T (AO) v1.01_01 sem inconsistências ou rejeições',
      ],
      previewStats: [
        { label: 'Chave Criptográfica', val: 'RSA-2048 bits' },
        { label: 'Retenção Automática', val: '6.5% em Serviços' },
        { label: 'Exportação SAF-T', val: 'Streaming O(1)' },
      ],
    },
    {
      id: 'inventory' as const,
      label: 'Stocks & Armazém',
      icon: Boxes,
      badge: 'Logística Avançada',
      title: 'Controlo Fino de Lotes, Validades e Conversão de Embalagens',
      desc: 'Ideal para grossistas e supermercados: compre em contentores, paletes ou caixas e venda à unidade com conversão automática de medidas (UoM) e Custo Médio Ponderado em tempo real.',
      bullets: [
        'Conversão dinâmica de unidades de medida (Ex.: 1 Caixa = 24 Unidades) com ajuste automático de stock',
        'Rastreio de lotes e datas de validade com regras FIFO (primeiro a entrar) e FEFO (primeiro a expirar)',
        'Transferências rápidas entre armazém central, filiais e viaturas de distribuição com guias de remessa',
        'Inventários rotativos e periódicos (cegos ou guiados) com geração de autos de quebra ou sobras',
      ],
      previewStats: [
        { label: 'Valorização de Stock', val: 'Custo Médio Ponderado' },
        { label: 'Multi-Armazém', val: 'Ilimitado' },
        { label: 'Controlo de Lotes', val: 'Regras FIFO / FEFO' },
      ],
    },
    {
      id: 'treasury' as const,
      label: 'Tesouraria & Caixa',
      icon: Wallet,
      badge: 'Fluxo Financeiro',
      title: 'Gestão de Caixas, Bancos e Projeção de Tesouraria a 90 Dias',
      desc: 'Visão cirúrgica de entradas e saídas. Controle múltiplos caixas físicos, contas bancárias em Kwanzas e divisas, e reconcilie pagamentos Multicaixa e transferências com precisão.',
      bullets: [
        'Sessões de caixa com abertura, sangrias, suprimentos e conferência detalhada por operador',
        'Contas bancárias empresariais (AOA, USD, EUR) com validação nativa de IBAN angolano',
        'Liquidação de faturas a prazo com emissão de Recibos de Quitação (RC)',
        'Painel dinâmico de Aging de dívidas de clientes e previsão de tesouraria a 30, 60 e 90 dias',
      ],
      previewStats: [
        { label: 'Moedas Suportadas', val: 'AOA, USD, EUR' },
        { label: 'Previsão de Caixa', val: '30, 60, 90 Dias' },
        { label: 'Aging de Clientes', val: 'Faixas automáticas' },
      ],
    },
    {
      id: 'payroll' as const,
      label: 'Recursos Humanos',
      icon: Users,
      badge: 'IRT 2026 & INSS',
      title: 'Folha Salarial Angolana e Ficheiro Bancário PS2 Multicaixa',
      desc: 'Automatize o cálculo de salários com o escalão oficial de IRT em vigor na República de Angola, apuramento dos 3% e 8% do INSS e geração de ficheiros de pagamento bancário em lote.',
      bullets: [
        'Tabela progressiva oficial de IRT e desconto de 3% de Segurança Social do funcionário + 8% encargo patronal',
        'Subsídios com aplicação das regras de isenção fiscal (transporte e alimentação dentro dos limites legais)',
        'Exportação direta do ficheiro bancário PS2 (Multicaixa) para pagamento de salários por transferência em lote',
        'Recibos de vencimento emitidos em PDF protegido para envio aos colaboradores',
      ],
      previewStats: [
        { label: 'Ficheiro Bancário', val: 'PS2 Multicaixa' },
        { label: 'Tabela IRT', val: 'Atualização 2026' },
        { label: 'Segurança Social', val: '3% + 8% Automático' },
      ],
    },
    {
      id: 'accounting' as const,
      label: 'Contabilidade PGC',
      icon: Calculator,
      badge: 'Classes 1 a 8',
      title: 'Contabilidade Geral e Analítica Conforme o PGC Angolano',
      desc: 'Esqueça lançamentos manuais demorados. A faturação, compras e pagamentos alimentam a contabilidade em partidas dobradas automáticas para emissão do Modelo 1 do Imposto Industrial.',
      bullets: [
        'Plano Geral de Contabilidade (PGC) com plano de contas oficial pré-parametrizado',
        'Integração direta com faturação e tesouraria para lançamentos automáticos de IVA e retenções',
        'Centros de custo analíticos para medição de rentabilidade por obra, loja ou projeto',
        'Balancetes de 2, 4 e 6 colunas, Demonstração de Resultados e Balanços em segundos',
      ],
      previewStats: [
        { label: 'Plano de Contas', val: 'PGC Angolano' },
        { label: 'Balancetes', val: '2, 4 e 6 Colunas' },
        { label: 'Lançamentos', val: 'Partidas Dobradas' },
      ],
    },
  ];

  const current = modules.find((m) => m.id === activeTab) || modules[0];

  return (
    <section id="modulos" className="py-16 sm:py-24 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Ecossistema Completo e Modular
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Tudo o que o seu negócio precisa num único software
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Módulos integrados de alto desempenho para substituir múltiplos programas isolados e eliminar planilhas manuais.
          </p>
        </div>

        {/* Tab Selectors */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const isSelected = activeTab === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTab(mod.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Content Card */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            {/* Left Content */}
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {current.badge}
              </span>

              <h3 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {current.title}
              </h3>

              <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
                {current.desc}
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                {current.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Metric Highlights */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                Especificações Técnicas do Módulo
              </h4>
              <div className="space-y-4">
                {current.previewStats.map((st, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800"
                  >
                    <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">
                      {st.label}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
                      {st.val}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl bg-emerald-500/10 p-3.5 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  Conexão Nativa com o Gateway Kudiba
                </div>
                <span>
                  Dados sincronizados com criptografia de ponta e trilha de auditoria imutável por utilizador e IP.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
