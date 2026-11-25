import React from 'react';
import { ShieldCheck, QrCode, FileCode, CheckCircle2, AlertTriangle, FileCheck } from 'lucide-react';

export const AgtComplianceSection: React.FC = () => {
  return (
    <section id="conformidade-agt" className="py-16 sm:py-24 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left: Text & Specs */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-500/30 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Conformidade Fiscal e Tributária em Angola</span>
            </div>

            <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              Certificação Homologada pela AGT: <br className="hidden sm:inline" />
              <span className="text-emerald-600 dark:text-emerald-400">
                Decreto Presidencial n.º 71/25
              </span>
            </h2>

            <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
              A Administração Geral Tributária (AGT) intensificou a fiscalização contra softwares não certificados ou alteráveis. O Kudiba ERP foi construído de raiz com regras fiscais invioláveis, assegurando que a sua empresa opera com 100% de tranquilidade jurídica.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <FileCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Cadeia RSA-2048 e 4 Chaves</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Assinatura criptográfica SHA-256 encadeada. Cada fatura referencia a anterior, tornando qualquer tentativa de adulteração impossível.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>QR Code Fiscal Oficial</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Impresso em formato gráfico nos documentos A4 e em caracteres ASCII/SVG nos talões térmicos de 80mm e 58mm.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>SAF-T (AO) v1.01_01 Nativo</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Validação sintática contra o XSD da AGT pré-emissão. O ficheiro é gerado em streaming sem risco de estouro de memória no servidor.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Validador de Alvarás SILAC</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Conexão aos portais SILAC/MINDCOM para validar o alvará de clientes e fornecedores, prevenindo multas e faturas não dedutíveis.
                </p>
              </div>
            </div>
          </div>

          {/* Right: AGT Seal Visual Card */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border-2 border-emerald-600/30 bg-gradient-to-b from-emerald-50/60 to-white p-8 shadow-xl dark:border-emerald-500/20 dark:from-slate-900 dark:to-slate-950">
              <div className="flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-700/30">
                  <ShieldCheck className="h-12 w-12" />
                </div>
              </div>

              <div className="mt-6 text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Certificado de Conformidade Fiscal
                </span>
                <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  Kudiba Invoicing Engine
                </h3>
                <p className="mt-1 font-mono text-xs font-extrabold text-slate-600 dark:text-slate-300">
                  Registo Oficial: FE/528/AGT/2026
                </p>
              </div>

              <div className="mt-6 space-y-2.5 rounded-2xl border border-slate-200/90 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Enquadramento Legal:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Decreto 71/25</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Regulamentação Técnica:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">Dec. Executivo 385/20</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Algoritmo de Chave:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">RSA 2048 bits</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Validação de Ficheiro:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">SAF-T (AO) 1.01_01</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Imutabilidade de Séries:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ativa (DB Triggers)</span>
                </div>
              </div>

              <div className="mt-6 text-center">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Garantia de Atualização Contínua sem Custos Adicionais
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
