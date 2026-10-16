import React from 'react';
import { Sidebar, ModuleKey } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  activeModule: ModuleKey;
  onSelectModule: (module: ModuleKey) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeModule,
  onSelectModule,
  children,
}) => {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar activeModule={activeModule} onSelectModule={onSelectModule} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
};
