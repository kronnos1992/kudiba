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
    <div className="flex h-dvh min-h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar activeModule={activeModule} onSelectModule={onSelectModule} />
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 w-full overflow-y-auto overflow-x-hidden">
          <div className="w-full max-w-[1600px] mx-auto p-3 sm:p-5 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
