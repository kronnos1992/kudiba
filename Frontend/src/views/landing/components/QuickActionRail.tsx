import React, { useState } from 'react';
import { ArrowRight, FileText, LifeBuoy, Phone, UserPlus, X } from 'lucide-react';
import { TermsAndPoliciesModal } from '../../../components/legal/TermsAndPoliciesModal';

interface QuickActionRailProps {
  onOpenDemo: () => void;
  onRequestCallback: (details: string) => void;
}

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

export const QuickActionRail: React.FC<QuickActionRailProps> = ({ onOpenDemo, onRequestCallback }) => {
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);

  const submitCallback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) return;
    onRequestCallback(`Pedido de contacto telefónico: ${name || 'Não informado'} · ${phone}`);
    setCallbackOpen(false);
    setName('');
    setPhone('');
    setAccepted(false);
  };

  return (
    <>
      <aside className="fixed right-0 top-1/3 z-30 hidden -translate-y-1/2 flex-col overflow-hidden rounded-l-md border border-r-0 border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 xl:flex">
        <button
          type="button"
          onClick={() => scrollTo('noticias')}
          className="flex w-11 items-center justify-center border-b border-slate-200 px-2 py-4 text-slate-600 transition hover:bg-emerald-50 hover:text-kudiba-primary dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Blog e notícias"
        >
          <FileText className="h-4 w-4" />
          <span className="mt-2 text-[10px] font-bold tracking-wide" style={{ writingMode: 'vertical-rl' }}>
            Blog
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenDemo}
          className="flex w-11 items-center justify-center border-b border-slate-200 px-2 py-4 text-slate-600 transition hover:bg-emerald-50 hover:text-kudiba-primary dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Quer aderir?"
        >
          <UserPlus className="h-4 w-4" />
          <span className="mt-2 text-[10px] font-bold tracking-wide" style={{ writingMode: 'vertical-rl' }}>
            Quer Aderir?
          </span>
        </button>
        <button
          type="button"
          onClick={() => scrollTo('faq')}
          className="flex w-11 items-center justify-center border-b border-slate-200 px-2 py-4 text-slate-600 transition hover:bg-emerald-50 hover:text-kudiba-primary dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          title="Apoio ao cliente"
        >
          <LifeBuoy className="h-4 w-4" />
          <span className="mt-2 text-[10px] font-bold tracking-wide" style={{ writingMode: 'vertical-rl' }}>
            Apoio ao Cliente
          </span>
        </button>
        <button
          type="button"
          onClick={() => setCallbackOpen((open) => !open)}
          className="flex w-11 items-center justify-center bg-kudiba-primary px-2 py-4 text-white transition hover:bg-kudiba-primary-dark dark:bg-emerald-700 dark:hover:bg-emerald-600"
          title="Ligue já!"
        >
          <Phone className="h-4 w-4" />
          <span className="mt-2 text-[10px] font-bold tracking-wide" style={{ writingMode: 'vertical-rl' }}>
            Ligue Já!
          </span>
        </button>
      </aside>

      {callbackOpen && (
        <div className="fixed right-12 top-1/3 z-40 hidden w-80 -translate-y-1/2 rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 xl:block">
          <div className="flex items-start justify-between">
            <div>
              <p className="landing-eyebrow">Contacto direto</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Ou nós ligamos!</h3>
            </div>
            <button
              type="button"
              onClick={() => setCallbackOpen(false)}
              aria-label="Fechar pedido de contacto"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <a
            href="tel:+244923000000"
            className="mt-3 inline-flex items-center gap-2 text-xl font-extrabold text-kudiba-primary dark:text-emerald-400"
          >
            <Phone className="h-4 w-4" /> +244 923 000 000
          </a>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Dias úteis, das 9h00 às 18h00.</p>

          <form onSubmit={submitCallback} className="mt-4 space-y-3">
            <div>
              <label htmlFor="callback-name" className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Nome *
              </label>
              <input
                id="callback-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O seu nome"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-kudiba-primary focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="callback-phone" className="mb-1 block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Telemóvel / WhatsApp *
              </label>
              <input
                id="callback-phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+244 9xx xxx xxx"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-kudiba-primary focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 accent-emerald-700"
              />
              <span>
                Li e aceito a{' '}
                <button
                  type="button"
                  onClick={() => setPrivacyOpen(true)}
                  className="font-bold text-kudiba-primary underline dark:text-emerald-400"
                >
                  Política de Privacidade
                </button>
                .
              </span>
            </label>
            <button
              type="submit"
              disabled={!accepted}
              className="landing-btn-primary w-full py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pedir contacto <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      <TermsAndPoliciesModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        defaultTab="privacy"
      />
    </>
  );
};
