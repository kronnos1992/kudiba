import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import type { CommercialEntity } from '../../api/inventory';

interface EntitiesTabProps {
  entities: CommercialEntity[];
  entitiesLoading: boolean;
}

export const EntitiesTab: React.FC<EntitiesTabProps> = ({ entities, entitiesLoading }) => {
  return (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">NIF / Identificador</th>
                    <th className="px-4 py-3">Razão Social / Nome</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Contacto / Email</th>
                    <th className="px-4 py-3">Localidade</th>
                    <th className="px-4 py-3 text-center">Agente Retenção</th>
                    <th className="px-4 py-3">IBAN AO06</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {entitiesLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        A carregar entidades...
                      </td>
                    </tr>
                  ) : entities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma entidade registada. Clique em "Registar Entidade" para adicionar clientes ou fornecedores.
                      </td>
                    </tr>
                  ) : (
                    entities.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {e.tax_id}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {e.name}
                          </span>
                          {e.trade_name && (
                            <span className="text-xs text-slate-400 block">{e.trade_name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              e.entity_type === 'CUSTOMER'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : e.entity_type === 'SUPPLIER'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {e.entity_type === 'CUSTOMER'
                              ? 'Cliente'
                              : e.entity_type === 'SUPPLIER'
                              ? 'Fornecedor'
                              : 'Cliente / Fornecedor'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          <div>{e.phone || '—'}</div>
                          <div>{e.email || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {e.city ? `${e.city}, ${e.province || 'Angola'}` : 'Angola'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {e.is_withholding_agent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Sim (Cativo)
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Não</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {e.iban || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
  );
};
