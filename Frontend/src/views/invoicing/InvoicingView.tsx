import React, { useState } from 'react';
import { PlusCircle, Eye, Printer, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

interface DocumentItem {
  id: string;
  type: string;
  client: string;
  nif: string;
  date: string;
  subtotal: number;
  tax: number;
  retention: number;
  total: number;
  hash4: string;
  status: string;
  statusText: string;
}

export const InvoicingView: React.FC = () => {
  const { activeTenant } = useAuthStore();
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);

  const mockDocuments: DocumentItem[] = [
    {
      id: 'FT 2026/00142',
      type: 'FT',
      client: 'Sonangol Distribuidora E.P.',
      nif: '5401239871',
      date: '16/10/2026',
      subtotal: 4254385.96,
      tax: 595614.04,
      retention: 276535.09,
      total: 4850000.0,
      hash4: '7a9f',
      status: 'ok',
      statusText: 'Certificada AGT',
    },
    {
      id: 'FR 2026/00891',
      type: 'FR',
      client: 'Consumidor Final',
      nif: '999999999',
      date: '16/10/2026',
      subtotal: 10921.05,
      tax: 1528.95,
      retention: 0.0,
      total: 12450.0,
      hash4: 'c12e',
      status: 'ok',
      statusText: 'Quitada',
    },
    {
      id: 'FT 2026/00141',
      type: 'FT',
      client: 'Unitel S.A.',
      nif: '5409871234',
      date: '15/10/2026',
      subtotal: 1596491.23,
      tax: 223508.77,
      retention: 103771.93,
      total: 1820000.0,
      hash4: 'f5d8',
      status: 'ok',
      statusText: 'Certificada AGT',
    },
    {
      id: 'NC 2026/00018',
      type: 'NC',
      client: 'ENSA Seguros',
      nif: '5405551234',
      date: '14/10/2026',
      subtotal: -83333.33,
      tax: -11666.67,
      retention: 0.0,
      total: -95000.0,
      hash4: '2b4c',
      status: 'medio',
      statusText: 'Nota de Crédito',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Faturação &amp; Gestão Fiscal AGT
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Emissão de FT, FR, NC e ND em conformidade com o Decreto Presidencial 71/25
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer">
          <PlusCircle className="w-4 h-4" />
          <span>Criar Novo Documento</span>
        </button>
      </div>

      <GlassCard className="p-4 no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Nº Documento</th>
                <th className="py-2.5 px-3">Cliente</th>
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3 text-right">Subtotal</th>
                <th className="py-2.5 px-3 text-right">IVA (14%)</th>
                <th className="py-2.5 px-3 text-right">Total (Kz)</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {mockDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs font-extrabold ${
                        doc.type === 'NC'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {doc.type}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                    {doc.id}
                  </td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{doc.client}</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">NIF: {doc.nif}</p>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">{doc.date}</td>
                  <td className="py-3 px-3 text-right">
                    <KzAmount value={doc.subtotal} />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <KzAmount value={doc.tax} />
                  </td>
                  <td className="py-3 px-3 text-right font-bold">
                    <KzAmount value={doc.total} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <StatusBadge status={doc.status as 'ok' | 'medio'} label={doc.statusText} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => setSelectedDoc(doc)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>A4</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal A4 AGT */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8">
            <button
              onClick={() => setSelectedDoc(null)}
              className="no-print absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="invoice-a4 bg-white text-slate-900 p-8 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-extrabold text-emerald-800">
                    {activeTenant?.name || 'KUDIBA COMÉRCIO GERAL, LDA'}
                  </h3>
                  <p className="text-xs text-slate-600">Luanda, Angola</p>
                  <p className="text-xs font-mono text-slate-600">
                    NIF: {activeTenant?.taxId || '5001234567'}
                  </p>
                </div>
                <div className="text-right">
                  <h4 className="text-lg font-extrabold text-slate-900">{selectedDoc.id}</h4>
                  <p className="text-xs text-slate-600">Data: {selectedDoc.date}</p>
                  <span className="inline-block mt-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ORIGINAL
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-200 my-4" />

              <div className="mb-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Dados do Cliente
                </span>
                <p className="font-bold text-sm text-slate-900">{selectedDoc.client}</p>
                <p className="text-xs font-mono text-slate-600">NIF: {selectedDoc.nif}</p>
              </div>

              <table className="w-full text-xs text-left mb-6">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <th className="py-2 px-3">Descrição</th>
                    <th className="py-2 px-3 text-right">Taxa IVA</th>
                    <th className="py-2 px-3 text-right">Valor (Kz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-3">Prestação de Serviços Especializados / Fornecimento</td>
                    <td className="py-2.5 px-3 text-right">14%</td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      <KzAmount value={selectedDoc.subtotal} />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Incidência:</span>
                    <KzAmount value={selectedDoc.subtotal} />
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total IVA (14%):</span>
                    <KzAmount value={selectedDoc.tax} />
                  </div>
                  {selectedDoc.retention > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Retenção (6,5%):</span>
                      <KzAmount value={selectedDoc.retention} />
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Total Documento:</span>
                    <KzAmount value={selectedDoc.total} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4 text-center text-[10px] text-slate-500 space-y-1">
                <p className="font-mono font-bold text-slate-700">
                  {selectedDoc.hash4}-Processado por programa validado nº 000/AGT/2026 Kudiba ERP
                </p>
                <p>Os bens/serviços foram colocados à disposição do adquirente na data do documento.</p>
              </div>
            </div>

            <div className="no-print flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir A4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
