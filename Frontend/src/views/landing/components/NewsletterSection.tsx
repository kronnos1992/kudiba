import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
  };

  return (
    <section className="border-b border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-950">
      <div className="landing-container">
        <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="landing-eyebrow">Subscreva a newsletter</span>
            <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
              Atualizações fiscais e novidades Kudiba no seu email
            </h2>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
              Receba alertas sobre alterações legislativas, novos módulos e boas práticas de gestão. Sem spam.
            </p>
          </div>
          {subscribed ? (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Subscrição registada para {email}.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="O seu email profissional"
                  className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-kudiba-primary focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <button type="submit" className="landing-btn-primary shrink-0 text-xs">
                Subscrever <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
