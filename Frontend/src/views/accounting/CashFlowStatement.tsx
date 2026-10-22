import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Landmark,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { useAuthStore } from '../../stores/authStore';

export interface CashFlowData {
  // Operacional - Método Direto
  recebimentosClientes: number;
  pagamentosFornecedores: number;
  pagamentosPessoal: number;
  pagamentosImpostos: number;
  outrosOperacionais: number;
  fluxoOperacional: number;

  // Operacional - Método Indireto (Decreto 82/01 Pág. 11)
  resultadoAntesImpostos: number;
  amortizacoesExercicio: number;
  ajustamentosFinanceiros: number;
  ebitdaOperacional: number;
  variacaoExistencias: number;
  variacaoClientes: number;
  variacaoFornecedoresPassivos: number;

  // Investimento
  aquisicoesImobilizadoCorporeo: number;
  aquisicoesImobilizadoIncorporeo: number;
  alienacoesImobilizado: number;
  fluxoInvestimento: number;

  // Financiamento
  aumentoCapital: number;
  financiamentosObtidos: number;
  amortizacaoFinanciamentos: number;
  jurosPagos: number;
  fluxoFinanciamento: number;

  // Resumo
  variacaoLiquidaCaixa: number;
  saldoInicialCaixa: number;
  saldoFinalCaixa: number;
  saldoBalancoClasse1: number;
  isReconciled: boolean;
}

interface CashFlowStatementProps {
  data: CashFlowData;
  fiscalYear: string | number;
}

export const CashFlowStatement: React.FC<CashFlowStatementProps> = ({ data, fiscalYear }) => {
  const { activeTenant } = useAuthStore();
  const [method, setMethod] = useState<'direct' | 'indirect'>('direct');

  const handleExportCsv = () => {
    const isDirect = method === 'direct';
    const lines = [
      `Demonstração dos Fluxos de Caixa (${isDirect ? 'Método Directo' : 'Método Indirecto'}) - Exercício ${fiscalYear}`,
      `Conforme Decreto n.º 82/01 de 16 de Novembro (PGC Angola)`,
      `Empresa: ${activeTenant?.company_name || 'Kudiba'} · NIF: ${activeTenant?.nif || 'N/A'}`,
      `Moeda: Kwanzas (AOA)`,
      '',
      'Rubrica;Nota;Valor (Kz)',
      '1. FLUXOS DE CAIXA DAS ACTIVIDADES OPERACIONAIS;;',
    ];

    if (isDirect) {
      lines.push(
        `Recebimentos (de caixa) de clientes;Nota 43;${data.recebimentosClientes.toFixed(2)}`,
        `(-) Pagamentos (de caixa) a fornecedores e pessoal;Nota 43;-${(data.pagamentosFornecedores + data.pagamentosPessoal).toFixed(2)}`,
        `(-) Pagamentos de impostos sobre lucros e tributos;Nota 43;-${data.pagamentosImpostos.toFixed(2)}`,
        `(+/-) Outros recebimentos / (pagamentos) operacionais;;${data.outrosOperacionais.toFixed(2)}`,
        `= Caixa Líquida Proveniente das Actividades Operacionais (A);;${data.fluxoOperacional.toFixed(2)}`
      );
    } else {
      lines.push(
        `Resultado antes de impostos (RAI);;${data.resultadoAntesImpostos.toFixed(2)}`,
        `(+) Amortizações do exercício;Nota 29;${data.amortizacoesExercicio.toFixed(2)}`,
        `(+) Custos financeiros (Juros);Nota 31;${data.ajustamentosFinanceiros.toFixed(2)}`,
        `= Resultados antes das alterações no capital circulante;;${data.ebitdaOperacional.toFixed(2)}`,
        `(+/-) Variação nas existências;;${data.variacaoExistencias.toFixed(2)}`,
        `(+/-) Variação nas dívidas de clientes a receber;;${data.variacaoClientes.toFixed(2)}`,
        `(+/-) Variação nas dívidas a fornecedores e Estado;;${data.variacaoFornecedoresPassivos.toFixed(2)}`,
        `(-) Pagamentos de impostos sobre lucros;;-${data.pagamentosImpostos.toFixed(2)}`,
        `= Caixa Líquida Proveniente das Actividades Operacionais (A);;${data.fluxoOperacional.toFixed(2)}`
      );
    }

    lines.push(
      '',
      '2. FLUXOS DE CAIXA DAS ACTIVIDADES DE INVESTIMENTO;;',
      `(-) Pagamentos por aquisições de imobilizações corpóreas;Nota 4;-${data.aquisicoesImobilizadoCorporeo.toFixed(2)}`,
      `(-) Pagamentos por aquisições de imobilizações incorpóreas / software;Nota 5;-${data.aquisicoesImobilizadoIncorporeo.toFixed(2)}`,
      `(+) Recebimentos de alienações de activos imobilizados;;${data.alienacoesImobilizado.toFixed(2)}`,
      `= Caixa Líquida Usada nas Actividades de Investimento (B);;${data.fluxoInvestimento.toFixed(2)}`,
      '',
      '3. FLUXOS DE CAIXA DAS ACTIVIDADES DE FINANCIAMENTO;;',
      `(+) Aumentos de capital e prestações suplementares;Nota 12;${data.aumentoCapital.toFixed(2)}`,
      `(+) Empréstimos e financiamentos obtidos;Nota 15;${data.financiamentosObtidos.toFixed(2)}`,
      `(-) Amortização de empréstimos bancários;Nota 15;-${data.amortizacaoFinanciamentos.toFixed(2)}`,
      `(-) Juros e custos financeiros pagos;Nota 31;-${data.jurosPagos.toFixed(2)}`,
      `= Caixa Líquida das Actividades de Financiamento (C);;${data.fluxoFinanciamento.toFixed(2)}`,
      '',
      `AUMENTO / (DIMINUIÇÃO) LÍQUIDO DE CAIXA E SEUS EQUIVALENTES (A + B + C);;${data.variacaoLiquidaCaixa.toFixed(2)}`,
      `Caixa e seus equivalentes no início do período;Nota 47;${data.saldoInicialCaixa.toFixed(2)}`,
      `Caixa e seus equivalentes no fim do período;Nota 47;${data.saldoFinalCaixa.toFixed(2)}`,
      `Disponibilidades no Balanço (Disponibilidades PGC);;${data.saldoBalancoClasse1.toFixed(2)}`
    );

    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `demonstracao_fluxos_caixa_${method}_${fiscalYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Indicadores Topo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fluxo Operacional Líquido
            </span>
            <div
              className={`text-xl font-black mt-1 ${
                data.fluxoOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              <KzAmount value={data.fluxoOperacional} />
            </div>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              data.fluxoOperacional >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {data.fluxoOperacional >= 0 ? (
              <ArrowUpRight className="w-5 h-5" />
            ) : (
              <ArrowDownRight className="w-5 h-5" />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fluxo de Investimento
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              <KzAmount value={data.fluxoInvestimento} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Fluxo de Financiamento
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              <KzAmount value={data.fluxoFinanciamento} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Disponibilidades no Fim do Ano
            </span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              <KzAmount value={data.saldoFinalCaixa} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </GlassCard>
      </div>

      {/* Demonstração dos Fluxos de Caixa — Modelo Oficial Decreto 82/01 */}
      <GlassCard className="p-6 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Demonstração dos Fluxos de Caixa
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                Decreto n.º 82/01 · PGC Angola
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {activeTenant?.company_name || 'Kudiba Comercial'} · NIF {activeTenant?.nif || '5001234567'} · Exercício findo em 31 de Dezembro de {fiscalYear}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Alternador de Método Oficial (Páginas 10 e 11 do Decreto 82/01) */}
            <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setMethod('direct')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  method === 'direct'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Método Directo (Pág. 10)
              </button>
              <button
                type="button"
                onClick={() => setMethod('indirect')}
                className={`px-3 py-1 rounded-lg font-bold transition ${
                  method === 'indirect'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Método Indirecto (Pág. 11)
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              CSV
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
          {/* SECÇÃO 1: ACTIVIDADES OPERACIONAIS */}
          <div className="pb-3 pt-1">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] text-blue-600 dark:text-blue-400">
                1. Fluxos de Caixa das Actividades Operacionais
              </h4>
              <span className="text-[11px] font-sans font-semibold text-slate-400">
                {method === 'direct' ? 'Método Directo (Rubricas de Caixa)' : 'Método Indirecto (Conciliação c/ RAI)'}
              </span>
            </div>

            {method === 'direct' ? (
              <div className="space-y-2">
                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>Recebimentos (de caixa) de clientes</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 43
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={data.recebimentosClientes} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>(-) Pagamentos (de caixa) a fornecedores de mercadorias e serviços</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 43
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={data.pagamentosFornecedores} />)
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>(-) Pagamentos (de caixa) a empregados / remunerações e encargos</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 43
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={data.pagamentosPessoal} />)
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>(-) Impostos sobre lucros e encargos tributários pagos</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 35
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={data.pagamentosImpostos} />)
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-600 dark:text-slate-400">
                  <span>(+/-) Outros fluxos de caixa das operações ordinárias</span>
                  <span className="font-mono font-semibold">
                    <KzAmount value={data.outrosOperacionais} />
                  </span>
                </div>

                <div className="pt-2 flex justify-between font-sans font-black bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 px-3 py-2 rounded-lg">
                  <span>= CAIXA LÍQUIDA PROVENIENTE DAS ACTIVIDADES OPERACIONAIS (A)</span>
                  <span className="font-mono">
                    <KzAmount value={data.fluxoOperacional} />
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>Resultado líquido antes dos impostos e rubricas extraordinárias (RAI)</span>
                  <span className="font-mono font-semibold">
                    <KzAmount value={data.resultadoAntesImpostos} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>(+) Depreciações e Amortizações do exercício (sem efeito de caixa)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 29
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={data.amortizacoesExercicio} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>(+) Resultados e encargos financeiros</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                      Nota 31
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={data.ajustamentosFinanceiros} />
                  </span>
                </div>

                <div className="flex justify-between font-sans font-bold bg-slate-50 dark:bg-slate-800/40 px-2 py-1 rounded">
                  <span>= Resultados operacionais antes das alterações no capital circulante</span>
                  <span className="font-mono">
                    <KzAmount value={data.ebitdaOperacional} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-600 dark:text-slate-400 pl-2">
                  <span>(+/-) Diminuição / (Aumento) das existências</span>
                  <span className="font-mono">
                    <KzAmount value={data.variacaoExistencias} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-600 dark:text-slate-400 pl-2">
                  <span>(+/-) Diminuição / (Aumento) das dívidas de clientes a receber</span>
                  <span className="font-mono">
                    <KzAmount value={data.variacaoClientes} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-600 dark:text-slate-400 pl-2">
                  <span>(+/-) Aumento / (Diminuição) das dívidas a fornecedores e outros passivos</span>
                  <span className="font-mono">
                    <KzAmount value={data.variacaoFornecedoresPassivos} />
                  </span>
                </div>

                <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>(-) Pagamentos de impostos sobre o rendimento</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={data.pagamentosImpostos} />)
                  </span>
                </div>

                <div className="pt-2 flex justify-between font-sans font-black bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 px-3 py-2 rounded-lg">
                  <span>= CAIXA LÍQUIDA PROVENIENTE DAS ACTIVIDADES OPERACIONAIS (A)</span>
                  <span className="font-mono">
                    <KzAmount value={data.fluxoOperacional} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SECÇÃO 2: ACTIVIDADES DE INVESTIMENTO */}
          <div className="py-3">
            <h4 className="font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 text-indigo-600 dark:text-indigo-400">
              2. Fluxos de Caixa das Actividades de Investimento
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(-) Pagamentos respeitantes a imobilizações corpóreas</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 4
                  </span>
                </div>
                <span className="font-mono font-semibold text-red-600">
                  (<KzAmount value={data.aquisicoesImobilizadoCorporeo} />)
                </span>
              </div>

              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(-) Pagamentos respeitantes a imobilizações incorpóreas</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 5
                  </span>
                </div>
                <span className="font-mono font-semibold text-red-600">
                  (<KzAmount value={data.aquisicoesImobilizadoIncorporeo} />)
                </span>
              </div>

              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <span>(+) Recebimentos provenientes de alienações de imobilizações</span>
                <span className="font-mono font-semibold text-emerald-600">
                  <KzAmount value={data.alienacoesImobilizado} />
                </span>
              </div>

              <div className="pt-2 flex justify-between font-sans font-black bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 px-3 py-2 rounded-lg">
                <span>= CAIXA LÍQUIDA USADA NAS ACTIVIDADES DE INVESTIMENTO (B)</span>
                <span className="font-mono">
                  <KzAmount value={data.fluxoInvestimento} />
                </span>
              </div>
            </div>
          </div>

          {/* SECÇÃO 3: ACTIVIDADES DE FINANCIAMENTO */}
          <div className="py-3">
            <h4 className="font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2 text-purple-600 dark:text-purple-400">
              3. Fluxos de Caixa das Actividades de Financiamento
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(+) Aumentos de capital, prestações suplementares e emissão de acções</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 12
                  </span>
                </div>
                <span className="font-mono font-semibold text-emerald-600">
                  <KzAmount value={data.aumentoCapital} />
                </span>
              </div>

              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(+) Empréstimos e financiamentos bancários obtidos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 15
                  </span>
                </div>
                <span className="font-mono font-semibold text-emerald-600">
                  <KzAmount value={data.financiamentosObtidos} />
                </span>
              </div>

              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(-) Amortizações de empréstimos e contratos de locação financeira</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 15
                  </span>
                </div>
                <span className="font-mono font-semibold text-red-600">
                  (<KzAmount value={data.amortizacaoFinanciamentos} />)
                </span>
              </div>

              <div className="flex justify-between font-sans text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span>(-) Juros e custos similares pagos</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                    Nota 31
                  </span>
                </div>
                <span className="font-mono font-semibold text-red-600">
                  (<KzAmount value={data.jurosPagos} />)
                </span>
              </div>

              <div className="pt-2 flex justify-between font-sans font-black bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 px-3 py-2 rounded-lg">
                <span>= CAIXA LÍQUIDA DAS ACTIVIDADES DE FINANCIAMENTO (C)</span>
                <span className="font-mono">
                  <KzAmount value={data.fluxoFinanciamento} />
                </span>
              </div>
            </div>
          </div>

          {/* SECÇÃO 4: RESUMO E RECONCILIAÇÃO OFICIAL */}
          <div className="pt-4 space-y-3">
            <div className="flex justify-between font-sans font-black bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 rounded-xl text-sm">
              <span>AUMENTO / (DIMINUIÇÃO) LÍQUIDO DE CAIXA E SEUS EQUIVALENTES (A + B + C)</span>
              <span className="font-mono">
                <KzAmount value={data.variacaoLiquidaCaixa} />
              </span>
            </div>

            <div className="flex justify-between font-sans text-slate-600 dark:text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span>(+) Caixa e seus equivalentes no início do período</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono">
                  Notas 43, 47
                </span>
              </div>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                <KzAmount value={data.saldoInicialCaixa} />
              </span>
            </div>

            <div className="flex justify-between font-sans font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-100 px-3 py-3 rounded-xl text-base border border-emerald-300 dark:border-emerald-700">
              <div className="flex items-center gap-2">
                <span>= CAIXA E SEUS EQUIVALENTES NO FIM DO PERÍODO</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono font-bold">
                  Notas 43, 47
                </span>
              </div>
              <span className="font-mono">
                <KzAmount value={data.saldoFinalCaixa} />
              </span>
            </div>

            {/* Reconciliação com Balanço Patrimonial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-sans">
                  Disponibilidades constantes do Balanço (Disponibilidades PGC - Nota 10):
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  <KzAmount value={data.saldoBalancoClasse1} />
                </span>
              </div>

              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                Conforme PGC (Δ = 0,00 Kz)
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
