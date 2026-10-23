import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { Warehouse } from '../../api/inventory';

interface WarehousesTabProps {
  warehouses: Warehouse[];
  warehousesLoading: boolean;
  activeBranchName?: string;
}

export const WarehousesTab: React.FC<WarehousesTabProps> = ({
  warehouses,
  warehousesLoading,
  activeBranchName,
}) => {
  return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {warehousesLoading ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                A carregar armazéns...
              </div>
            ) : warehouses.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                Nenhum armazém registado. Clique em "Novo Armazém" para começar.
              </div>
            ) : (
              warehouses.map((w) => (
                <GlassCard key={w.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded">
                        {w.code}
                      </span>
                      {w.is_default && (
                        <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded">
                          Principal / Padrão
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {w.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {w.address_detail || 'Sem endereço especificado'}
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <StatusBadge status={w.is_active ? 'ok' : 'acompanhar'} label={w.is_active ? 'Operacional' : 'Inativo'} />
                    <span className="text-xs text-slate-400">Filial {activeBranchName || 'Sede'}</span>
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </div>
  );
};
