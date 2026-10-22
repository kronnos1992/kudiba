import React, { useState } from 'react';
import {
  FileText,
  Building2,
  Scale,
  Landmark,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  Calendar,
  Layers,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { useAuthStore } from '../../stores/authStore';

export interface FinancialNotesData {
  // Meios Financeiros (Nota 4 e 10)
  caixaGeral: number;
  depositosOrdem: number;
  outrosDepositos: number;
  totalMeiosFinanceiros: number;

  // Clientes e Outras Contas a Receber (Nota 9)
  clientesContaCorrente: number;
  outrosDevedores: number;
  totalClientesOutrosDevedores: number;

  // Existências (Nota 8)
  mercadorias: number;
  materiasPrimas: number;
  totalExistencias: number;

  // Imobilizado Corpóreo e Incorpóreo (Notas 4 e 5)
  imobilizacoesCorporeas: number;
  imobilizacoesIncorporeas: number;
  amortizacoesAcumuladas: number;
  ativoLiquidoNaoCorrente: number;

  // Fornecedores e Contas a Pagar (Notas 19 e 20)
  fornecedoresCorrentes: number;
  remuneracoesPagar: number;
  outrosCredores: number;
  totalPassivoCorrente: number;

  // Estado e Impostos (Nota 9 e 35)
  ivaLiquidado: number;
  ivaDedutivel: number;
  ivaApurado: number;
  irtRetido: number;
  retencaoServicos: number;
  impostoIndustrialEstimado: number;

  // Capital Próprio e Reservas (Notas 12, 13, 14)
  capitalSocial: number;
  reservasLegais: number;
  resultadosTransitados: number;
  resultadoLiquido: number;
  totalCapitalProprio: number;

  // Demonstração de Resultados (Notas 22 e 35)
  vendas: number;
  prestacoesServicos: number;
}

interface FinancialNotesStatementProps {
  data: FinancialNotesData;
  fiscalYear: string | number;
}

type NoteGroup = 'all' | 'intro' | 'balance' | 'income' | 'other' | 'cash_flow';

export const FinancialNotesStatement: React.FC<FinancialNotesStatementProps> = ({
  data,
  fiscalYear,
}) => {
  const { activeTenant } = useAuthStore();
  const [selectedGroup, setSelectedGroup] = useState<NoteGroup>('all');
  const [onlyMaterial, setOnlyMaterial] = useState(false);

  // Total Ativo e Total Proveitos para regra de materialidade (Art. 5.2 Decreto 82/01)
  const totalActivo =
    data.ativoLiquidoNaoCorrente + data.totalExistencias + data.totalClientesOutrosDevedores + data.totalMeiosFinanceiros;
  const limiarMaterialidadeActivo = totalActivo * 0.1; // 10% do total do Activo
  const isMaterial = (val: number) => !onlyMaterial || Math.abs(val) >= limiarMaterialidadeActivo;

  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({
    nota1: true,
    nota2: true,
    nota3: true,
    nota4: true,
    nota5: true,
    nota8: true,
    nota9: true,
    nota10: true,
    nota12: true,
    nota13: true,
    nota14: true,
    nota20: true,
    nota22: true,
    nota27: true,
    nota28: true,
    nota29: true,
    nota31: true,
    nota35: true,
    nota38: true,
    nota43: true,
    nota47: true,
  });

  const toggleNote = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    const ids = [
      'nota1', 'nota2', 'nota3', 'nota4', 'nota5', 'nota8', 'nota9', 'nota10',
      'nota12', 'nota13', 'nota14', 'nota20', 'nota22', 'nota27', 'nota28', 'nota29',
      'nota31', 'nota35', 'nota38', 'nota43', 'nota47',
    ];
    ids.forEach((k) => {
      updated[k] = val;
    });
    setExpandedNotes(updated);
  };

  const handleExportCsv = () => {
    const lines = [
      `Notas às Demonstrações Financeiras (Anexo ao Balanço e DRE) - Exercício ${fiscalYear}`,
      `Conforme Decreto n.º 82/01 de 16 de Novembro (PGC Angola)`,
      `Entidade: ${activeTenant?.company_name || 'Kudiba'} · NIF: ${activeTenant?.nif || 'N/A'}`,
      `Moeda: Kwanzas (AOA)`,
      '',
      'Número da Nota;Título Oficial;Rubricas / Descrição;Valor (Kz)',
      `Nota 4;Imobilizado Corpóreo;Equipamentos, viaturas e instalações;${data.imobilizacoesCorporeas.toFixed(2)}`,
      `Nota 4;Imobilizado Corpóreo;(-) Amortizações acumuladas;-${data.amortizacoesAcumuladas.toFixed(2)}`,
      `Nota 5;Imobilizado Incorpóreo;Software, patentes e licenças;${data.imobilizacoesIncorporeas.toFixed(2)}`,
      `Nota 8;Existências;Mercadorias em armazém (CMP);${data.mercadorias.toFixed(2)}`,
      `Nota 8;Existências;Matérias-primas e subsidiárias;${data.materiasPrimas.toFixed(2)}`,
      `Nota 9;Contas a Receber;Clientes em conta corrente;${data.clientesContaCorrente.toFixed(2)}`,
      `Nota 9;Contas a Receber;Outros devedores;${data.outrosDevedores.toFixed(2)}`,
      `Nota 10;Disponibilidades;Caixa geral;${data.caixaGeral.toFixed(2)}`,
      `Nota 10;Disponibilidades;Depósitos à ordem em bancos;${data.depositosOrdem.toFixed(2)}`,
      `Nota 12;Capital;Capital social subscrito e realizado;${data.capitalSocial.toFixed(2)}`,
      `Nota 13;Reservas;Reservas legais e estatutárias;${data.reservasLegais.toFixed(2)}`,
      `Nota 14;Resultados Transitados;Resultados acumulados de anos anteriores;${data.resultadosTransitados.toFixed(2)}`,
      `Nota 20;Contas a Pagar;Fornecedores em conta corrente;${data.fornecedoresCorrentes.toFixed(2)}`,
      `Nota 20;Contas a Pagar;Remunerações a pagar ao pessoal;${data.remuneracoesPagar.toFixed(2)}`,
      `Nota 20;Contas a Pagar;Estado e encargos tributários (IVA/IRT);${(data.ivaApurado + data.irtRetido).toFixed(2)}`,
      `Nota 22;Volume de Negócios;Vendas de mercadorias e produtos (71);${data.vendas.toFixed(2)}`,
      `Nota 22;Volume de Negócios;Prestações de serviços (72);${data.prestacoesServicos.toFixed(2)}`,
      `Nota 22;Volume de Negócios;Total Volume de Negócios;${(data.vendas + data.prestacoesServicos).toFixed(2)}`,
      `Nota 35;Imposto sobre o Rendimento;Estimativa de Imposto Industrial;${data.impostoIndustrialEstimado.toFixed(2)}`,
      `Nota 47;Caixa e Equivalentes;Total de disponibilidades no fecho;${data.totalMeiosFinanceiros.toFixed(2)}`,
    ];

    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notas_contas_decreto_82_01_${fiscalYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Painel de Filtro Oficial */}
      <GlassCard className="p-6 w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Notas às Contas (Anexo às Demonstrações Financeiras)
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Decreto n.º 82/01 · PGC Angola
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Divulgações obrigatórias e notas explicativas às rubricas do Balanço, DRE e DFC — Exercício de {fiscalYear}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => expandAll(true)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Expandir Todas
            </button>
            <button
              type="button"
              onClick={() => expandAll(false)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              Colapsar
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ml-1"
            >
              <Download className="w-4 h-4 text-purple-600" />
              CSV
            </button>
          </div>
        </div>

        {/* Barra de Filtros por Secção do Decreto 82/01 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 text-xs overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedGroup('all')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'all'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Todas as Notas
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('intro')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'intro'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Introdução (1 a 3)
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('balance')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'balance'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Notas ao Balanço (4 a 21)
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('income')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'income'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Notas à DRE (22 a 35)
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('other')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'other'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Outras (36 a 42)
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup('cash_flow')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                selectedGroup === 'cash_flow'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Fluxos de Caixa (43 a 49)
            </button>
          </div>

          {/* Filtro de Materialidade (Decreto 82/01, Ponto 5.2) */}
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyMaterial}
              onChange={(e) => setOnlyMaterial(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            <span title="Ocultar notas dispensadas pelo Ponto 5.2 do Decreto 82/01 (inferiores a 10% do Activo)">
              Critério de Materialidade (Art. 5.2 &gt; 10%)
            </span>
          </label>
        </div>

        {/* NOTAS - GRUPO I: INTRODUÇÃO */}
        {(selectedGroup === 'all' || selectedGroup === 'intro') && (
          <div className="space-y-3 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              I. Introdução e Enquadramento Legal
            </div>

            {/* NOTA 1: ACTIVIDADE */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleNote('nota1')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Nota 1 — Actividade da Entidade
                </span>
                {expandedNotes.nota1 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedNotes.nota1 && (
                <div className="p-4 text-xs space-y-3 bg-white dark:bg-slate-900">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    A sociedade <strong className="text-slate-900 dark:text-white">{activeTenant?.company_name || 'Kudiba Comercial & Serviços Lda'}</strong>, matriculada na Conservatória do Registo Comercial sob o n.º <span className="font-mono">{activeTenant?.commercial_registry || 'CRC Luanda n.º 2026-00412'}</span>, é titular do NIF <strong className="font-mono">{activeTenant?.nif || '5001234567'}</strong>, com sede em <span className="font-medium">{activeTenant?.address_detail || 'Avenida 4 de Fevereiro, Marginal de Luanda'}, {activeTenant?.city || 'Luanda'} (Angola)</span>.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block font-sans">Regime Fiscal:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {activeTenant?.tax_regime_code || 'REGIME GERAL (CIVA)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Certificação AGT:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {activeTenant?.agt_cert_number || '42/AGT/2026'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Capital Social:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {activeTenant?.share_capital || '2.000.000,00 Kz'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-sans">Moeda Operacional:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Kwanza (AOA)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* NOTA 2: BASES DE PREPARAÇÃO */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleNote('nota2')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  Nota 2 — Bases de Preparação das Demonstrações Financeiras e Derrogações
                </span>
                {expandedNotes.nota2 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedNotes.nota2 && (
                <div className="p-4 text-xs space-y-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    As demonstrações financeiras foram preparadas no pressuposto da <strong>continuidade das operações</strong>, a partir dos livros e registos contabilísticos mantidos em conformidade com o <strong>Plano Geral de Contabilidade (PGC) de Angola</strong> (Decreto n.º 82/01 de 16 de Novembro) e normas tributárias em vigor.
                  </p>
                  <p>
                    Não foram praticadas derrogações aos princípios e regras contabilísticas definidos no PGC de Angola durante o exercício findo.
                  </p>
                </div>
              )}
            </div>

            {/* NOTA 3: POLÍTICAS CONTABILÍSTICAS */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleNote('nota3')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500" />
                  Nota 3 — Alterações e Principais Políticas Contabilísticas Adoptadas
                </span>
                {expandedNotes.nota3 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedNotes.nota3 && (
                <div className="p-4 text-xs space-y-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      <strong>Custeio de Inventários:</strong> Valorizados ao Custo Médio Ponderado (CMP), nos termos do Ponto 2.5 do Decreto 82/01.
                    </li>
                    <li>
                      <strong>Imobilizado Corpóreo:</strong> Depreciado sistematicamente em linha recta (quotas constantes) pelas taxas máximas do Decreto 53/05.
                    </li>
                    <li>
                      <strong>Regime de Acréscimo:</strong> Reconhecimento dos proveitos e custos no período a que respeitam, independentemente da data de recebimento ou pagamento.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOTAS - GRUPO II: NOTAS AO BALANÇO */}
        {(selectedGroup === 'all' || selectedGroup === 'balance') && (
          <div className="space-y-3 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              II. Notas ao Balanço (Ativo, Passivo e Capital Próprio)
            </div>

            {/* NOTA 4: IMOBILIZADO CORPÓREO */}
            {isMaterial(data.imobilizacoesCorporeas - data.amortizacoesAcumuladas) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota4')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    Nota 4 — Imobilizado Corpóreo (Meios Fixos Corpóreos)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      <KzAmount value={data.imobilizacoesCorporeas - data.amortizacoesAcumuladas} />
                    </span>
                    {expandedNotes.nota4 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota4 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 space-y-3">
                    <p className="text-slate-500 text-[11px]">
                      Quadro oficial de composição e amortizações acumuladas (Decreto 82/01, Pág. 16):
                    </p>
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubricas</th>
                          <th className="pb-2 text-right">Valor Bruto</th>
                          <th className="pb-2 text-right">Amortizações Acum.</th>
                          <th className="pb-2 text-right">Valor Líquido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Equipamento Básico, Transporte e Informática</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.imobilizacoesCorporeas} /></td>
                          <td className="py-2 text-right text-red-600 font-bold">(<KzAmount value={data.amortizacoesAcumuladas} />)</td>
                          <td className="py-2 text-right font-black text-blue-600">
                            <KzAmount value={data.imobilizacoesCorporeas - data.amortizacoesAcumuladas} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 5: IMOBILIZADO INCORPÓREO */}
            {isMaterial(data.imobilizacoesIncorporeas) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota5')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Nota 5 — Imobilizado Incorpóreo (Activos Fixos Intangíveis)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      <KzAmount value={data.imobilizacoesIncorporeas} />
                    </span>
                    {expandedNotes.nota5 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota5 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 space-y-3">
                    <p className="text-slate-500 text-[11px]">
                      Composição das imobilizações incorpóreas (Decreto 82/01, Pág. 16):
                    </p>
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubricas</th>
                          <th className="pb-2 text-right">Valor Líquido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Projectos de Desenvolvimento, Softwares e Licenças</td>
                          <td className="py-2 text-right font-bold text-blue-600">
                            <KzAmount value={data.imobilizacoesIncorporeas} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 8: EXISTÊNCIAS */}
            {isMaterial(data.totalExistencias) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota8')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" />
                    Nota 8 — Existências (Inventários em Armazém)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                      <KzAmount value={data.totalExistencias} />
                    </span>
                    {expandedNotes.nota8 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota8 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900">
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubrica Contabilística</th>
                          <th className="pb-2 text-right">Saldo em 31/Dez/{fiscalYear}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Mercadorias em Armazém (Valorizadas a CMP)</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.mercadorias} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Matérias-Primas e Subsidiárias</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.materiasPrimas} /></td>
                        </tr>
                        <tr className="bg-slate-100 dark:bg-slate-800 font-bold font-sans text-slate-900 dark:text-white">
                          <td className="py-2.5 px-1">TOTAL DE EXISTÊNCIAS</td>
                          <td className="py-2.5 px-1 text-right font-mono"><KzAmount value={data.totalExistencias} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 9: CONTAS A RECEBER */}
            {isMaterial(data.totalClientesOutrosDevedores) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota9')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Nota 9 — Contas a Receber (Clientes e Outros Devedores)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-blue-600 text-xs">
                      <KzAmount value={data.totalClientesOutrosDevedores} />
                    </span>
                    {expandedNotes.nota9 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota9 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900">
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubrica Contabilística</th>
                          <th className="pb-2 text-right">Saldo em 31/Dez/{fiscalYear}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Clientes — Contas Correntes</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.clientesContaCorrente} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Outros Devedores e Adiantamentos</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.outrosDevedores} /></td>
                        </tr>
                        <tr className="bg-blue-50/50 dark:bg-blue-950/20 font-bold font-sans text-blue-800 dark:text-blue-300">
                          <td className="py-2.5 px-1">TOTAL DE CONTAS A RECEBER</td>
                          <td className="py-2.5 px-1 text-right font-mono"><KzAmount value={data.totalClientesOutrosDevedores} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 10: DISPONIBILIDADES */}
            {isMaterial(data.totalMeiosFinanceiros) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota10')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-blue-600" />
                    Nota 10 — Disponibilidades (Caixa e Depósitos em Bancos)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-600 text-xs">
                      <KzAmount value={data.totalMeiosFinanceiros} />
                    </span>
                    {expandedNotes.nota10 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota10 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900">
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubricas</th>
                          <th className="pb-2 text-right">Saldo em 31/Dez/{fiscalYear}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Caixa (Numerário em moeda nacional)</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.caixaGeral} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Depósitos à Ordem em Instituições Bancárias</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.depositosOrdem} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Outros Depósitos e Equivalentes de Caixa</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.outrosDepositos} /></td>
                        </tr>
                        <tr className="bg-emerald-50/50 dark:bg-emerald-950/20 font-bold font-sans text-emerald-800 dark:text-emerald-300">
                          <td className="py-2.5 px-1">TOTAL DAS DISPONIBILIDADES</td>
                          <td className="py-2.5 px-1 text-right font-mono"><KzAmount value={data.totalMeiosFinanceiros} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 12: CAPITAL */}
            {isMaterial(data.capitalSocial) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota12')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Nota 12 — Capital e Composição Societária
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-600 text-xs">
                      <KzAmount value={data.capitalSocial} />
                    </span>
                    {expandedNotes.nota12 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota12 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 space-y-2">
                    <p>
                      O capital social subscrito e integralmente realizado é de <strong className="font-mono text-slate-900 dark:text-white"><KzAmount value={data.capitalSocial} /></strong>, dividido nos termos do pacto social arquivado na Conservatória do Registo Comercial.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 13: RESERVAS LEGAIS */}
            {isMaterial(data.reservasLegais) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota13')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Nota 13 — Reservas Legais e Estatutárias
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-teal-600 text-xs">
                      <KzAmount value={data.reservasLegais} />
                    </span>
                    {expandedNotes.nota13 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota13 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 space-y-2">
                    <p>
                      As reservas legais acumuladas em cumprimento da Lei das Sociedades Comerciais de Angola ascendem a <strong className="font-mono text-slate-900 dark:text-white"><KzAmount value={data.reservasLegais} /></strong> (mínimo de 5% dos lucros anuais destinados à constituição da reserva legal).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 14: RESULTADOS TRANSITADOS */}
            {isMaterial(data.resultadosTransitados) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota14')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Scale className="w-4 h-4 text-cyan-600" />
                    Nota 14 — Resultados Transitados de Exercícios Anteriores
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-xs ${data.resultadosTransitados >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      <KzAmount value={data.resultadosTransitados} />
                    </span>
                    {expandedNotes.nota14 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota14 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 space-y-2">
                    <p>
                      O saldo da conta de Resultados Transitados (conta 59) reflecte os lucros ou prejuízos acumulados de exercícios anteriores ainda não distribuídos ou integrados no capital: <strong className="font-mono text-slate-900 dark:text-white"><KzAmount value={data.resultadosTransitados} /></strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 20: CONTAS A PAGAR */}
            {isMaterial(data.totalPassivoCorrente) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota20')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-red-500" />
                    Nota 20 — Contas a Pagar (Fornecedores, Pessoal e Estado)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-red-600 text-xs">
                      <KzAmount value={data.totalPassivoCorrente} />
                    </span>
                    {expandedNotes.nota20 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota20 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900">
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubricas</th>
                          <th className="pb-2 text-right">Saldo em 31/Dez/{fiscalYear}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Fornecedores — Contas Correntes</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.fornecedoresCorrentes} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Pessoal — Remunerações a Pagar e Encargos</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.remuneracoesPagar} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Estado — Tributos Correntes (IVA e IRT)</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.ivaApurado + data.irtRetido} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Outros Credores</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.outrosCredores} /></td>
                        </tr>
                        <tr className="bg-red-50/50 dark:bg-red-950/20 font-bold font-sans text-red-900 dark:text-red-200">
                          <td className="py-2.5 px-1">TOTAL DE CONTAS A PAGAR</td>
                          <td className="py-2.5 px-1 text-right font-mono"><KzAmount value={data.totalPassivoCorrente} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* NOTAS - GRUPO III: NOTAS À DRE */}
        {(selectedGroup === 'all' || selectedGroup === 'income') && (
          <div className="space-y-3 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              III. Notas à Demonstração de Resultados
            </div>

            {/* NOTA 22: VOLUME DE NEGÓCIOS */}
            {isMaterial(data.vendas + data.prestacoesServicos) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota22')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Nota 22 — Volume de Negócios (Vendas e Serviços Prestados)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-blue-600 text-xs">
                      <KzAmount value={data.vendas + data.prestacoesServicos} />
                    </span>
                    {expandedNotes.nota22 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota22 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900">
                    <table className="w-full text-left font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 font-sans">
                          <th className="pb-2">Rubricas (Decreto 82/01, Pág. 21)</th>
                          <th className="pb-2 text-right">Montante do Exercício ({fiscalYear})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Vendas de Mercadorias e Produtos (Conta 61)</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.vendas} /></td>
                        </tr>
                        <tr>
                          <td className="py-2 text-slate-700 dark:text-slate-300 font-sans">Prestações de Serviços (Conta 62)</td>
                          <td className="py-2 text-right font-bold"><KzAmount value={data.prestacoesServicos} /></td>
                        </tr>
                        <tr className="bg-blue-50/50 dark:bg-blue-950/20 font-bold font-sans text-blue-800 dark:text-blue-300">
                          <td className="py-2.5 px-1">TOTAL DO VOLUME DE NEGÓCIOS</td>
                          <td className="py-2.5 px-1 text-right font-mono"><KzAmount value={data.vendas + data.prestacoesServicos} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* NOTA 35: IMPOSTO SOBRE O RENDIMENTO */}
            {isMaterial(data.impostoIndustrialEstimado) && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleNote('nota35')}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-600" />
                    Nota 35 — Imposto sobre o Rendimento (Imposto Industrial)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-red-600 text-xs">
                      <KzAmount value={data.impostoIndustrialEstimado} />
                    </span>
                    {expandedNotes.nota35 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedNotes.nota35 && (
                  <div className="p-4 text-xs bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 space-y-2">
                    <p>
                      A entidade encontra-se sujeita a tributação em sede de <strong>Imposto Industrial (Grupo A)</strong>. O imposto apurado no exercício à taxa nominal de 25% sobre a matéria coletável ascende a <strong className="font-mono text-slate-900 dark:text-white"><KzAmount value={data.impostoIndustrialEstimado} /></strong>.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* NOTAS - GRUPO IV: OUTRAS DIVULGAÇÕES E FLUXOS DE CAIXA */}
        {(selectedGroup === 'all' || selectedGroup === 'other' || selectedGroup === 'cash_flow') && (
          <div className="space-y-3 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              IV. Acontecimentos Pós-Balanço e Fluxos de Caixa
            </div>

            {/* NOTA 38: PÓS-BALANÇO */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleNote('nota38')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Nota 38 — Acontecimentos Ocorridos Após a Data do Balanço
                </span>
                {expandedNotes.nota38 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedNotes.nota38 && (
                <div className="p-4 text-xs space-y-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    Entre a data de encerramento do exercício de {fiscalYear} e a data de aprovação das presentes contas, não se verificaram acontecimentos materiais favoráveis ou desfavoráveis que exijam ajustamento nos valores relatados.
                  </p>
                </div>
              )}
            </div>

            {/* NOTA 47: CAIXA E EQUIVALENTES */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleNote('nota47')}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Nota 47 — Caixa e Seus Equivalentes (Conciliação c/ Fluxos de Caixa)
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-emerald-600 text-xs">
                    <KzAmount value={data.totalMeiosFinanceiros} />
                  </span>
                  {expandedNotes.nota47 ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </button>

              {expandedNotes.nota47 && (
                <div className="p-4 text-xs space-y-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    A quantia de caixa e seus equivalentes evidenciada na Demonstração dos Fluxos de Caixa coincide rigorosamente com o total da rubrica de <strong>Disponibilidades (Nota 10)</strong> constante do Balanço Patrimonial em 31 de Dezembro de {fiscalYear}: <strong className="font-mono text-emerald-600 dark:text-emerald-400"><KzAmount value={data.totalMeiosFinanceiros} /></strong>.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
