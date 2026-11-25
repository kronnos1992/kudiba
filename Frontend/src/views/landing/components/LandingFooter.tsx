import React, { useState } from 'react';
import { ArrowUp, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { TermsAndPoliciesModal } from '../../../components/legal/TermsAndPoliciesModal';

interface LandingFooterProps {
  onOpenLogin: () => void;
  onOpenDemo: () => void;
}

type LegalTab = 'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal';

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

export const LandingFooter: React.FC<LandingFooterProps> = ({ onOpenLogin, onOpenDemo }) => {
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('terms');

  const openLegal = (tab: LegalTab) => {
    setLegalTab(tab);
    setLegalModalOpen(true);
  };

  const link = (label: string, id: string) => (
    <button type="button" onClick={() => scrollTo(id)} className="text-left transition hover:text-emerald-400">
      {label}
    </button>
  );

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="landing-container py-12 lg:py-16">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-6">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3">
              <img src="/favicon.svg" alt="Kudiba" className="h-10 w-10 rounded-lg" />
              <span className="flex flex-col">
                <span className="text-xl font-extrabold leading-none tracking-tight text-white">
                  Kudiba<span className="text-emerald-400">ERP</span>
                </span>
                <span className="mt-1 text-[10px] font-semibold tracking-wide text-slate-500">por MONAIT</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-xs leading-relaxed">
              Solução integrada de gestão empresarial para Angola. Faturação certificada, contabilidade PGC, stocks, salários e vendas em balcão com operação ininterrupta.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Certificação AGT n.º FE/528/AGT/2026
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">Kudiba ERP</h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>{link('Sobre a Kudiba', 'topo')}</li>
              <li>{link('Soluções', 'solucoes')}</li>
              <li>{link('Vantagens', 'vantagens')}</li>
              <li>{link('Conformidade AGT', 'conformidade-agt')}</li>
              <li>{link('Planos e Preços', 'planos')}</li>
              <li>{link('Contabilistas', 'contabilistas')}</li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">Suporte e Recursos</h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>{link('Apoio ao Cliente', 'faq')}</li>
              <li>{link('Perguntas Frequentes', 'faq')}</li>
              <li>{link('Simulador de Poupança', 'calculadora')}</li>
              <li>{link('Notícias e Recursos', 'noticias')}</li>
              <li>
                <button type="button" onClick={onOpenLogin} className="transition hover:text-emerald-400">
                  Portal do Cliente
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">Notícias e Eventos</h4>
            <ul className="mt-4 space-y-2.5 text-xs">
              <li>{link('Blog Kudiba', 'noticias')}</li>
              <li>{link('Guias Práticos', 'noticias')}</li>
              <li>{link('Atualizações Fiscais', 'noticias')}</li>
              <li>{link('Newsletter', 'noticias')}</li>
              <li>{link('Falar com um Consultor', 'planos')}</li>
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-200">Contactos</h4>
            <div className="mt-4 space-y-3 text-xs">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                Luanda, República de Angola
              </p>
              <p className="flex items-start gap-2">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                comercial@kudiba.ao
              </p>
              <p className="flex items-start gap-2">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <a href="tel:+244923000000" className="transition hover:text-emerald-400">
                  +244 923 000 000
                </a>
              </p>
              <button type="button" onClick={onOpenDemo} className="landing-btn-primary px-3 py-2 text-[11px]">
                Contactar agora
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-6 text-[11px] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Kudiba ERP. Todos os direitos reservados. Faturado em Kwanzas em Angola.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => openLegal('terms')} className="transition hover:text-slate-200">Termos de Uso</button>
            <span className="text-slate-700">•</span>
            <button type="button" onClick={() => openLegal('privacy')} className="transition hover:text-slate-200">Privacidade (Lei 22/11)</button>
            <span className="text-slate-700">•</span>
            <button type="button" onClick={() => openLegal('data_processing')} className="transition hover:text-slate-200">Tratamento de Dados</button>
            <span className="text-slate-700">•</span>
            <button type="button" onClick={() => openLegal('subscription')} className="transition hover:text-slate-200">Subscrição</button>
            <span className="text-slate-700">•</span>
            <button type="button" onClick={() => openLegal('fiscal')} className="transition hover:text-slate-200">Certificação AGT</button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="Voltar ao topo"
              className="rounded-md border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <TermsAndPoliciesModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        defaultTab={legalTab}
      />
    </footer>
  );
};
