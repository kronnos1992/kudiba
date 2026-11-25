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
          {/* Brand info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md">
                <span className="font-sans text-xl font-black text-amber-300">K</span>
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Kudiba<span className="text-emerald-400">ERP</span>
              </span>
            </div>
            <p className="mt-4 text-xs sm:text-sm text-slate-400 max-w-sm leading-relaxed">
              Sistema Integrado de Gestão Empresarial e Ponto de Venda de 4.ª geração (*Cloud-Native* e *Edge-Ready*). Homologado e certificado pela Administração Geral Tributária (AGT).
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Certificado AGT N.º FE/528/AGT/2026</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Soluções & Módulos
            </h4>
            <ul className="mt-4 space-y-2 text-xs text-slate-400">
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Kudiba POS (Ponto de Venda)
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Faturação Comercial AGT
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Gestão de Stocks & Armazéns
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Tesouraria & Caixa Diário
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Recursos Humanos (IRT 2026)
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-emerald-400 transition">
                  Contabilidade PGC Angolano
                </a>
              </li>
            </ul>
          </div>

          {/* Tools & Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Recursos
            </h4>
            <ul className="mt-4 space-y-2 text-xs text-slate-400">
              <li>
                <a href="#calculadora" className="hover:text-emerald-400 transition">
                  Calculadora de Poupança TCO
                </a>
              </li>
              <li>
                <a href="#comparativo" className="hover:text-emerald-400 transition">
                  Kudiba vs ERPs Legados
                </a>
              </li>
              <li>
                <a href="#conformidade-agt" className="hover:text-emerald-400 transition">
                  Decreto Presidencial 71/25
                </a>
              </li>
              <li>
                <a href="#contabilistas" className="hover:text-emerald-400 transition">
                  Programa para Contabilistas
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-emerald-400 transition">
                  Planos em Kwanzas
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="text-emerald-400 font-semibold hover:underline"
                >
                  Entrar no Sistema ERP
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Contactos em Angola
            </h4>
            <div className="mt-4 space-y-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Luanda, República de Angola</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>suporte@kudiba.ao</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>+244 923 000 000 (WhatsApp)</span>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenDemo}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition"
                >
                  Solicitar Demonstração
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legal & Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Kudiba ERP. Todos os direitos reservados. Faturado em Kwanzas.</p>

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
              Enquadramento Fiscal AGT
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
