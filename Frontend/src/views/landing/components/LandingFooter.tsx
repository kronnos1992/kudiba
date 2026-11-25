import React, { useState } from 'react';
import { ShieldCheck, Mail, Phone, MapPin, ArrowUp } from 'lucide-react';
import { TermsAndPoliciesModal } from '../../../components/legal/TermsAndPoliciesModal';

interface LandingFooterProps {
  onOpenLogin: () => void;
  onOpenDemo: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenLogin, onOpenDemo }) => {
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<
    'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal'
  >('terms');

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLegal = (
    tab: 'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal'
  ) => {
    setLegalModalTab(tab);
    setIsLegalModalOpen(true);
  };

  return (
    <footer className="border-t border-slate-200 bg-slate-900 text-white dark:border-slate-800 dark:bg-black">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand info & MONAIT */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white shadow-md">
                <span className="font-sans text-xl font-black text-amber-300">K</span>
              </div>
              <div>
                <span className="text-xl font-extrabold tracking-tight text-white">
                  Kudiba<span className="text-emerald-400">ERP</span>
                </span>
                <span className="ml-2 text-xs font-semibold text-slate-400">
                  por MONAIT
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
              Solução Integrada de Gestão Empresarial para o mercado de Angola. Rigor fiscal, contabilidade PGC, recursos humanos e vendas em balcão com operação ininterrupta.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Certificação Oficial AGT n.º FE/528/AGT/2026</span>
            </div>
          </div>

          {/* Soluções Empresariais */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Soluções
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li>
                <a href="#solucoes" className="hover:text-emerald-400 transition">
                  Faturação & POS AGT
                </a>
              </li>
              <li>
                <a href="#solucoes" className="hover:text-emerald-400 transition">
                  Contabilidade PGC Angola
                </a>
              </li>
              <li>
                <a href="#solucoes" className="hover:text-emerald-400 transition">
                  Gestão de Stocks & CMP
                </a>
              </li>
              <li>
                <a href="#solucoes" className="hover:text-emerald-400 transition">
                  Salários, IRT & INSS
                </a>
              </li>
              <li>
                <a href="#solucoes" className="hover:text-emerald-400 transition">
                  Multi-Filial & Holding
                </a>
              </li>
            </ul>
          </div>

          {/* Decisão & Recursos */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Recursos
            </h4>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li>
                <a href="#vantagens" className="hover:text-emerald-400 transition">
                  Porquê o Kudiba?
                </a>
              </li>
              <li>
                <a href="#conformidade-agt" className="hover:text-emerald-400 transition">
                  Decreto Presidencial 71/25
                </a>
              </li>
              <li>
                <a href="#calculadora" className="hover:text-emerald-400 transition">
                  Simulador de Poupança
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-emerald-400 transition">
                  Planos em Kwanzas (AOA)
                </a>
              </li>
              <li>
                <a href="#contabilistas" className="hover:text-emerald-400 transition">
                  Programa para Contabilistas
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Entrar no Kudiba ERP
                </button>
              </li>
            </ul>
          </div>

          {/* MONAIT Contact & Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              MONAIT · Angola
            </h4>
            <div className="mt-4 space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Luanda, República de Angola</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>comercial@monait.ao</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>+244 923 000 000 (Atendimento)</span>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="rounded-xl bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  Agendar Apresentação
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legal & Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} Kudiba ERP é uma marca e produto da <strong>MONAIT</strong>. Todos os direitos reservados. Faturado em Kwanzas na República de Angola.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => openLegal('terms')}
              className="hover:text-slate-300 transition"
            >
              Termos de Uso
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegal('privacy')}
              className="hover:text-slate-300 transition"
            >
              Privacidade (Lei 22/11)
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegal('subscription')}
              className="hover:text-slate-300 transition"
            >
              Subscrição
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => openLegal('fiscal')}
              className="hover:text-slate-300 transition"
            >
              Certificação AGT
            </button>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Voltar ao topo"
            className="rounded-lg border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      <TermsAndPoliciesModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        defaultTab={legalModalTab}
      />
    </footer>
  );
};
