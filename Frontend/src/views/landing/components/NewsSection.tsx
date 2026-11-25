import React from 'react';
import { ArrowRight, BookOpen, CalendarDays, FileCheck, WifiOff } from 'lucide-react';

interface NewsSectionProps {
  onNavigate: (id: string) => void;
}

const articles = [
  {
    category: 'Atualidade Fiscal',
    date: '18 de novembro de 2026',
    title: 'Decreto 71/25: o que muda na faturação eletrónica em Angola',
    excerpt:
      'Saiba quais os documentos abrangidos, os prazos de adoção e de que forma a assinatura digital e o QR Code fiscal passam a integrar a sua operação diária.',
    icon: FileCheck,
    target: 'conformidade-agt',
  },
  {
    category: 'Guias Práticos',
    date: '04 de novembro de 2026',
    title: 'Como preparar o ficheiro SAF-T (AO) sem rejeições no portal tributário',
    excerpt:
      'Um checklist simples para validar os dados mestres, séries documentais e impostos antes de entregar o ficheiro mensal de auditoria tributária.',
    icon: BookOpen,
    target: 'conformidade-agt',
  },
  {
    category: 'Gestão & Operações',
    date: '21 de outubro de 2026',
    title: 'Vendas no balcão: por que a venda offline é essencial em Angola',
    excerpt:
      'Entenda como o ponto de venda pode continuar a faturar e a imprimir talões durante falhas de rede, sincronizando depois com a nuvem central.',
    icon: WifiOff,
    target: 'solucoes',
  },
];

export const NewsSection: React.FC<NewsSectionProps> = ({ onNavigate }) => {
  return (
    <section id="noticias" className="border-b border-slate-200 bg-slate-50 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:py-20">
      <div className="landing-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="landing-eyebrow">Notícias e recursos</span>
            <h2 className="landing-title">Fique a par do que importa para o seu negócio</h2>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Atualizações legislativas, guias práticos e novidades da equipa Kudiba.
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('faq')} className="landing-text-link shrink-0">
            Centro de ajuda <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {articles.map((article) => {
            const Icon = article.icon;
            return (
              <article key={article.title} className="landing-card flex flex-col p-6 transition hover:border-kudiba-primary dark:hover:border-emerald-500">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-kudiba-primary dark:text-emerald-400">
                    <Icon className="h-3.5 w-3.5" /> {article.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <CalendarDays className="h-3 w-3" /> {article.date}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold leading-snug text-slate-900 dark:text-white">{article.title}</h3>
                <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{article.excerpt}</p>
                <button
                  type="button"
                  onClick={() => onNavigate(article.target)}
                  className="landing-text-link mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"
                >
                  Saber mais <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
