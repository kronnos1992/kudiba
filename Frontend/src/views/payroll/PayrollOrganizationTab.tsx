import React from 'react';
import { Briefcase, Building2 } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { Department, JobPosition } from '../../api/payroll';

interface PayrollOrganizationTabProps {
  departments: Department[];
  jobPositions: JobPosition[];
}

export const PayrollOrganizationTab: React.FC<PayrollOrganizationTabProps> = ({
  departments,
  jobPositions,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <GlassCard className="p-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-emerald-600" />
        Departamentos da Empresa
      </h3>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {departments.length === 0 ? (
          <div className="py-4 text-xs text-slate-500">Nenhum departamento registado.</div>
        ) : (
          departments.map((department) => (
            <div key={department.id} className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                  {department.name}
                </span>
                <span className="font-mono text-xs text-slate-400">{department.code}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>

    <GlassCard className="p-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-blue-600" />
        Cargos &amp; Carreiras
      </h3>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {jobPositions.length === 0 ? (
          <div className="py-4 text-xs text-slate-500">Nenhum cargo registado.</div>
        ) : (
          jobPositions.map((position) => (
            <div key={position.id} className="py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-slate-900 dark:text-white block">
                  {position.title}
                </span>
                <span className="font-mono text-xs text-slate-400">{position.code}</span>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-400 block">Faixa Salarial:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Number(position.base_salary_min).toLocaleString('pt-AO')} -{' '}
                  {Number(position.base_salary_max).toLocaleString('pt-AO')} Kz
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  </div>
);
