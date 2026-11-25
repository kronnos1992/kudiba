import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'O que acontece às minhas vendas se a internet ou o operador de telecomunicações falhar?',
      a: 'Com o Kudiba POS, a operação não pára. O ponto de venda utiliza uma arquitetura Local-First que armazena localmente os artigos, assina as faturas com o algoritmo fiscal da AGT e imprime os talões térmicos com QR Code normalmente. Assim que a internet regressa, todas as vendas são sincronizadas automaticamente com o servidor central sem qualquer perda de dados.',
    },
    {
      q: 'Como é feita a migração dos artigos, clientes e stocks do Primavera, PHC ou Sage para o Kudiba?',
      a: 'O processo é rápido e assistido pela nossa equipa técnica. Podemos carregar a base de dados a partir do ficheiro SAF-T de faturação do seu sistema anterior ou através de ficheiros Excel/CSV. Em 24 a 48 horas a sua empresa já está a faturar no Kudiba com todos os clientes, artigos e preços atualizados.',
    },
    {
      q: 'O Kudiba está em conformidade com o novo Decreto Presidencial n.º 71/25 da AGT?',
      a: 'Sim. O Kudiba ERP foi desenvolvido e certificado estritamente de acordo com as exigências técnicas da AGT (Registo FE/528/AGT/2026). Possui criptografia RSA-2048, encadeamento SHA-256, os 4 caracteres impressos obrigatórios, QR Code e validação sintática do ficheiro SAF-T (AO) v1.01_01.',
    },
    {
      q: 'Preciso de comprar um servidor caro com Windows Server para a minha loja ou escritório?',
      a: 'Não! Essa é uma das maiores vantagens do Kudiba. O sistema corre sobre Linux e PostgreSQL open-source, eliminando os elevados custos de licenciamento da Microsoft (Windows Server e MS SQL Server). Pode usar os computadores que já tem na loja ou um simples mini-PC como terminal.',
    },
    {
      q: 'Os preços apresentados são fixos em Kwanzas ou sofrem ajustes com o câmbio?',
      a: 'Os preços do Kudiba são 100% fixados em Kwanzas (AOA) e faturados em território angolano. A sua empresa não corre o risco de ver a mensalidade duplicar de um mês para o outro devido à desvalorização cambial face ao Dólar ou Euro.',
    },
    {
      q: 'Como funciona o suporte técnico e a assistência presencial nas províncias?',
      a: 'Disponibilizamos suporte remoto imediato via WhatsApp, telefone e ligação remota para todo o país. Para clientes com planos PME e Corporate ou redes de lojas fora de Luanda (Benguela, Huambo, Huíla, Cabinda, etc.), dispomos de técnicos parceiros credenciados para instalação de hardware e apoio local.',
    },
  ];

  return (
    <section id="faq" className="py-16 sm:py-24 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Perguntas Frequentes</span>
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Tire todas as suas dúvidas sobre o Kudiba ERP
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Tudo o que precisa de saber antes de modernizar a gestão da sua empresa.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 transition"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80 mt-1">
                    <p className="pt-3">{faq.a}</p>
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
