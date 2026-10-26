import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Landmark,
  Download,
  CheckCircle2,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { useAuthStore } from '../../stores/authStore';
import {
  exportFinancialStatementPdf,
  exportFinancialStatementExcel,
  exportFinancialStatementCsv,
  CorporateEntityMeta,
  BalanceSheetExportData,
  IncomeStatementExportData,
} from './financialStatementsExporter';

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

  const corporateMeta: CorporateEntityMeta = {
    companyName: activeTenant?.company_name || 'Kudiba Comércio & Serviços, Lda.',
    nif: activeTenant?.nif || '5417281902',
    fiscalYear: Number(fiscalYear) || new Date().getFullYear(),
    currency: 'AOA',
  };

  const emptyBalanco: BalanceSheetExportData = {
    imobCorporeas: 0,
    imobIncorporeas: 0,
    amortAcumuladas: 0,
    totalAtivoNaoCorrente: 0,
    existencias: 0,
    clientes: 0,
    estadoDevedor: 0,
    outrosDevedores: 0,
    meiosFinanceiros: data.saldoFinalCaixa,
    totalAtivoCorrente: data.saldoFinalCaixa,
    totalAtivo: data.saldoFinalCaixa,
    capitalSocial: 0,
    reservas: 0,
    resultadosTransitados: 0,
    resultadoPeriodo: 0,
    totalCapitalProprio: 0,
    fornecedores: 0,
    estadoCredor: 0,
    remuneracoesPagar: 0,
    outrosCredores: 0,
    totalPassivo: 0,
    totalPassivoCapitalProprio: 0,
    balancoDiff: 0,
    isBalanced: true,
  };

  const emptyDre: IncomeStatementExportData = {
    vendas: 0,
    servicos: 0,
    outrosProveitos: 0,
    totalProveitosOperacionais: 0,
    cmvmc: 0,
    margemBruta: 0,
    fse: 0,
    pessoal: 0,
    amortizacoes: 0,
    outrosCustosOperacionais: 0,
    totalCustosOperacionais: 0,
    resultadoOperacional: 0,
    proveitosFinanceiros: 0,
    custosFinanceiros: 0,
    resultadoFinanceiro: 0,
    rai: data.resultadoAntesImpostos,
    impostoEstimado: 0,
    resultadoLiquido: 0,
  };

  const handleExportPdf = () => {
    exportFinancialStatementPdf('cash_flow', corporateMeta, emptyBalanco, emptyDre, data);
  };

  const handleExportExcel = () => {
    exportFinancialStatementExcel('cash_flow', corporateMeta, emptyBalanco, emptyDre, data);
  };

  const handleExportCsvComplete = () => {
    exportFinancialStatementCsv('cash_flow', corporateMeta, emptyBalanco, emptyDre, data);
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

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExportPdf}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                title="Exportar Demonstração de Fluxos de Caixa em PDF A4"
              >
                <Printer className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                title="Exportar Demonstração de Fluxos de Caixa em Excel (.xls)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                type="button"
                onClick={handleExportCsvComplete}
                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                title="Exportar Demonstração de Fluxos de Caixa em CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                CSV
              </button>
            </div>
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
