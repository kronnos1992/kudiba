import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'O que acontece às vendas no balcão quando o fornecedor de internet tem falhas?',
      a: 'Com o Kudiba POS, o atendimento ao público não pára. O ponto de venda foi concebido para continuar a emitir faturas e a imprimir talões térmicos com QR Code mesmo sem internet. Assim que a rede estabiliza, os dados de venda são sincronizados automaticamente com a nuvem central.',
    },
    {
      q: 'Como é realizada a migração a partir do sistema atual da empresa?',
      a: 'A transição é assistida diretamente pela nossa equipa técnica especializada. Importamos a lista de artigos, clientes, preços de venda e saldos de stock a partir de cópias de segurança, ficheiros SAF-T anteriores ou folhas de cálculo. A sua equipa fica operacional num prazo médio de 24 a 48 horas.',
    },
    {
      q: 'O Kudiba ERP está homologado e certificado pela Administração Geral Tributária (AGT)?',
      a: 'Sim. O Kudiba ERP é uma solução certificada pela AGT sob o Registo n.º FE/528/AGT/2026, com total conformidade com o Decreto Presidencial n.º 71/25 e o Decreto Executivo n.º 385/20, incluindo a geração e validação do ficheiro SAF-T (AO) v1.01.',
    },
    {
      q: 'Os preços da subscrição são estáveis ou sofrem alterações cambiais ao longo do ano?',
      a: 'Todos os planos do Kudiba ERP são fixados e faturados 100% em Kwanzas (AOA) em território angolano. A sua empresa tem total previsibilidade de custos operacionais, sem estar exposta à volatilidade do Dólar ou do Euro.',
    },
    {
      q: 'Como funciona a assistência técnica e formação nas diferentes províncias de Angola?',
      a: 'Disponibilizamos apoio de proximidade com suporte telefónico, WhatsApp e assistência remota em tempo real. Para empresas com filiais fora de Luanda (Benguela, Huambo, Huíla, Cabinda e outras), prestamos apoio de implementação e formação operacional das equipas.',
    },
  ];

  return (
    <section id="faq" className="py-16 sm:py-24 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="landing-eyebrow">
            Esclarecimentos Frequentes
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Perguntas Frequentes sobre o Kudiba ERP
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Respostas diretas às principais dúvidas de empresários, administradores e contabilistas.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 sm:p-6 text-left text-sm sm:text-base font-bold text-slate-900 hover:text-emerald-800 dark:text-white dark:hover:text-emerald-400 transition"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-800 dark:text-emerald-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
