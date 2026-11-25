import React, { useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardList,
  FileCheck,
  Globe2,
  Landmark,
  LayoutDashboard,
  Menu,
  Moon,
  Phone,
  Receipt,
  Search,
  Store,
  Sun,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useUiStore } from '../../../stores/uiStore';
import type { LandingModuleId } from './FeaturesShowcaseSection';

interface LandingNavbarProps {
  onOpenLogin: () => void;
  onOpenDemo: () => void;
  onSelectModule: (id: LandingModuleId) => void;
}

type MenuKey = 'solucoes' | 'produtos' | 'setores' | null;

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

const searchTargets: { label: string; hint: string; id: string; module?: LandingModuleId }[] = [
  { label: 'Faturação & POS', hint: 'Faturação, talões e QR Code', id: 'solucoes', module: 'invoicing' },
  { label: 'Contabilidade', hint: 'Classes 0 a 8 e balancetes', id: 'solucoes', module: 'accounting' },
  { label: 'Stocks & Armazéns', hint: 'CMP, lotes e validade', id: 'solucoes', module: 'inventory' },
  { label: 'Salários, IRT & INSS', hint: 'Folha salarial e Lei 12/23', id: 'solucoes', module: 'payroll' },
  { label: 'Multi-Filial & Holding', hint: 'Consolidação de lojas', id: 'solucoes', module: 'multi' },
  { label: 'Conformidade Fiscal', hint: 'Decreto 71/25 e SAF-T', id: 'conformidade-agt' },
  { label: 'Simulador de Poupança', hint: 'Compare custos em Kwanzas', id: 'calculadora' },
  { label: 'Planos e Preços', hint: 'Subscrições em AOA', id: 'planos' },
  { label: 'Programa para Contabilistas', hint: 'Perfil de auditor gratuito', id: 'contabilistas' },
  { label: 'Notícias e Recursos', hint: 'Atualidades e guias práticos', id: 'noticias' },
];

const solutionGroups: {
  title: string;
  items: { label: string; desc: string; module: LandingModuleId; icon: typeof Receipt }[];
}[] = [
  {
    title: 'Empresas',
    items: [
      { label: 'Faturação & POS', desc: 'Documentos certificados e venda offline', module: 'invoicing', icon: Receipt },
      { label: 'Contabilidade', desc: 'Plano oficial e fecho de exercício', module: 'accounting', icon: Calculator },
      { label: 'Stocks & Armazéns', desc: 'CMP, lotes e multi-localização', module: 'inventory', icon: Boxes },
    ],
  },
  {
    title: 'Gestão & Estrutura',
    items: [
      { label: 'Salários, IRT & INSS', desc: 'Folha salarial conforme a Lei 12/23', module: 'payroll', icon: Users },
      { label: 'Multi-Filial & Holding', desc: 'Visão consolidada do grupo', module: 'multi', icon: Building2 },
      { label: 'Tesouraria & Caixas', desc: 'Liquidez, bancos e fecho de caixa', module: 'multi', icon: Landmark },
    ],
  },
  {
    title: 'Contabilistas',
    items: [
      { label: 'Perfil de Auditor', desc: 'Acesso gratuito aos clientes', module: 'accounting', icon: ClipboardList },
      { label: 'SAF-T (AO) v1.01', desc: 'Exportação validada', module: 'accounting', icon: FileCheck },
      { label: 'Mapas PGC e Modelo 1', desc: 'Balancetes a 4 e 6 colunas', module: 'accounting', icon: LayoutDashboard },
    ],
  },
];

const productGroups: {
  title: string;
  badge: string;
  desc: string;
  target: string;
}[] = [
  { title: 'Kudiba Comercial', badge: 'Pequenas Empresas', desc: 'Faturação e POS a partir de 35.000 Kz/mês', target: 'planos' },
  { title: 'Kudiba PME Integrado', badge: 'Médias Empresas', desc: 'Faturação, stocks, salários e tesouraria', target: 'planos' },
  { title: 'Kudiba Corporate', badge: 'Grandes Empresas', desc: 'PGC completo e consolidação multi-filial', target: 'planos' },
  { title: 'Valorkeep · Manutenção', badge: 'Solução Complementar', desc: 'Ativos, manutenção e ordens de serviço', target: 'solucoes' },
];

const sectors: { label: string; desc: string; icon: typeof Store }[] = [
  { label: 'Comércio & Retalho', desc: 'Lojas, POS e inventário', icon: Store },
  { label: 'Restauração', desc: 'Balcão, mesas e talões', icon: Receipt },
  { label: 'Indústria', desc: 'Produção e custos', icon: Warehouse },
  { label: 'Serviços', desc: 'Faturação e retenções', icon: ClipboardList },
  { label: 'Construção', desc: 'Obras e projetos', icon: Building2 },
  { label: 'Logística', desc: 'Armazéns e distribuição', icon: Boxes },
];

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenLogin, onOpenDemo, onSelectModule }) => {
  const { themeMode, toggleTheme } = useUiStore();
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const results = searchTargets.filter((target) =>
    `${target.label} ${target.hint}`.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const goTo = (id: string, module?: LandingModuleId) => {
    setOpenMenu(null);
    setMobileOpen(false);
    setSearchOpen(false);
    if (module) onSelectModule(module);
    else scrollTo(id);
  };

  const renderMenuPanel = () => {
    if (openMenu === 'solucoes') {
      return (
        <div className="grid grid-cols-1 gap-8 p-8 sm:p-10 lg:grid-cols-3">
          {solutionGroups.map((group) => (
            <div key={group.title}>
              <p className="border-b border-slate-200 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800">
                {group.title}
              </p>
              <div className="mt-3 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => goTo('solucoes', item.module)}
                      className="group flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-emerald-50 dark:hover:bg-slate-800"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-kudiba-primary dark:text-emerald-400" />
                      <span>
                        <span className="block text-sm font-bold text-slate-900 dark:text-white group-hover:text-kudiba-primary dark:group-hover:text-emerald-400">
                          {item.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (openMenu === 'produtos') {
      return (
        <div className="p-8 sm:p-10">
          <p className="border-b border-slate-200 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800">
            Soluções por dimensão da empresa
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {productGroups.map((product) => (
              <button
                key={product.title}
                type="button"
                onClick={() => goTo(product.target)}
                className="landing-card group p-4 text-left transition hover:border-kudiba-primary dark:hover:border-emerald-500"
              >
                <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-kudiba-primary dark:bg-emerald-950/50 dark:text-emerald-400">
                  {product.badge}
                </span>
                <span className="mt-3 block text-sm font-bold text-slate-900 dark:text-white">{product.title}</span>
                <span className="mt-1 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{product.desc}</span>
                <span className="landing-text-link mt-3">
                  Saber mais <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 sm:p-10">
        <p className="border-b border-slate-200 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-800">
          Soluções setoriais
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {sectors.map((sector) => {
            const Icon = sector.icon;
            return (
              <button
                key={sector.label}
                type="button"
                onClick={() => goTo('solucoes')}
                className="landing-card group p-4 text-left transition hover:border-kudiba-primary dark:hover:border-emerald-500"
              >
                <Icon className="h-5 w-5 text-kudiba-primary dark:text-emerald-400" />
                <span className="mt-3 block text-xs font-bold text-slate-900 dark:text-white">{sector.label}</span>
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{sector.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="border-b border-slate-800 bg-slate-950 text-slate-300">
        <div className="landing-container flex h-9 items-center justify-between text-[11px]">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
              <Globe2 className="h-3.5 w-3.5" />
              Angola · Português
            </span>
            <span className="hidden h-3 w-px bg-slate-700 sm:block" />
            <button type="button" onClick={() => goTo('noticias')} className="hidden hover:text-white sm:inline-block">
              Blog
            </button>
            <button type="button" onClick={() => goTo('faq')} className="hidden hover:text-white sm:inline-block">
              Apoio ao Cliente
            </button>
          </div>
          <div className="flex items-center gap-4">
            <a href="tel:+244923000000" className="inline-flex items-center gap-1.5 font-semibold hover:text-white">
              <Phone className="h-3.5 w-3.5" />
              <span>+244 923 000 000</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setSearchOpen((open) => !open);
                setOpenMenu(null);
              }}
              className="inline-flex items-center gap-1.5 hover:text-white"
              aria-label="Procurar no site"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Procurar</span>
            </button>
            <button type="button" onClick={onOpenLogin} className="hidden font-semibold hover:text-white sm:inline-block">
              Área de Clientes
            </button>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="border-b border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="landing-container">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                autoFocus
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Procurar soluções, planos, recursos..."
                className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-kudiba-primary focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
              {results.length === 0 ? (
                <p className="p-3 text-xs text-slate-500">Sem resultados. Tente outro termo.</p>
              ) : (
                results.map((target) => (
                  <button
                    key={target.label}
                    type="button"
                    onClick={() => goTo(target.id, target.module)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{target.label}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{target.hint}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="relative border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="landing-container flex h-16 items-center justify-between">
          <button type="button" onClick={() => goTo('topo')} className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="Kudiba" className="h-9 w-9 rounded-lg" />
            <span className="flex flex-col text-left">
              <span className="text-lg font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">
                Kudiba<span className="text-kudiba-primary dark:text-emerald-400">ERP</span>
              </span>
              <span className="mt-1 text-[10px] font-semibold tracking-wide text-slate-400">por MONAIT</span>
            </span>
          </button>

          <nav className="hidden h-full items-center gap-1 lg:flex">
            {(['solucoes', 'produtos', 'setores'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onMouseEnter={() => {
                  setOpenMenu(key);
                  setSearchOpen(false);
                }}
                onClick={() => setOpenMenu(openMenu === key ? null : key)}
                aria-expanded={openMenu === key}
                className={`inline-flex h-full items-center gap-1.5 border-b-2 px-3 text-sm font-semibold transition ${
                  openMenu === key
                    ? 'border-kudiba-primary text-kudiba-primary dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-slate-700 hover:text-kudiba-primary dark:text-slate-300 dark:hover:text-emerald-400'
                }`}
              >
                {key === 'solucoes' ? 'Soluções' : key === 'produtos' ? 'Produtos' : 'Setores'}
                <ChevronDown className={`h-3.5 w-3.5 transition ${openMenu === key ? 'rotate-180' : ''}`} />
              </button>
            ))}
            <button
              type="button"
              onMouseEnter={() => setOpenMenu(null)}
              onClick={() => goTo('conformidade-agt')}
              className="px-3 text-sm font-semibold text-slate-700 transition hover:text-kudiba-primary dark:text-slate-300 dark:hover:text-emerald-400"
            >
              Conformidade Fiscal
            </button>
            <button
              type="button"
              onMouseEnter={() => setOpenMenu(null)}
              onClick={() => goTo('planos')}
              className="px-3 text-sm font-semibold text-slate-700 transition hover:text-kudiba-primary dark:text-slate-300 dark:hover:text-emerald-400"
            >
              Planos
            </button>
            <button
              type="button"
              onMouseEnter={() => setOpenMenu(null)}
              onClick={() => goTo('contabilistas')}
              className="px-3 text-sm font-semibold text-slate-700 transition hover:text-kudiba-primary dark:text-slate-300 dark:hover:text-emerald-400"
            >
              Contabilistas
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              className="rounded-md p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenDemo}
              className="hidden rounded-md border border-slate-300 px-4 py-2 text-xs font-bold text-slate-800 transition hover:border-kudiba-primary hover:text-kudiba-primary dark:border-slate-700 dark:text-slate-200 md:inline-flex"
            >
              Contactar
            </button>
            <button type="button" onClick={onOpenLogin} className="landing-btn-primary px-4 py-2 text-xs">
              Entrar <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Abrir menu"
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {openMenu && (
          <div
            onMouseLeave={() => setOpenMenu(null)}
            className="absolute left-0 right-0 top-full hidden border-b border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:block"
          >
            <div className="landing-container">{renderMenuPanel()}</div>
            <div className="border-t border-slate-200 bg-slate-50 px-8 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="landing-container flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Não sabe qual solução escolher? A nossa equipa ajuda a definir a melhor opção.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenDemo();
                  }}
                  className="landing-text-link"
                >
                  Falar com um consultor <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {mobileOpen && (
        <div className="border-b border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <div className="grid grid-cols-1 gap-1">
            {solutionGroups.flatMap((group) => group.items).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => goTo('solucoes', item.module)}
                className="rounded-md px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {item.label}
              </button>
            ))}
            {[
              { label: 'Conformidade Fiscal', id: 'conformidade-agt' },
              { label: 'Simulador de Poupança', id: 'calculadora' },
              { label: 'Planos e Preços', id: 'planos' },
              { label: 'Contabilistas', id: 'contabilistas' },
              { label: 'Notícias e Recursos', id: 'noticias' },
              { label: 'FAQ', id: 'faq' },
            ].map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => goTo(link.id)}
                className="rounded-md px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
