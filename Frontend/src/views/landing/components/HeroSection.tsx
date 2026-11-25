import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  LayoutDashboard,
  QrCode,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenLogin: () => void;
}

type SlideId = 'fiscal' | 'pos' | 'gestao';

const slides: {
  id: SlideId;
  tag: string;
  title: string;
  subtitle: string;
  description: string;
  primary: { label: string; target?: string };
  secondary: { label: string; target: string };
  gradient: string;
}[] = [
  {
    id: 'fiscal',
    tag: 'Faturação Eletrónica · AGT',
    title: 'Prepare-se para a faturação eletrónica.',
    subtitle: 'Documentos certificados, QR Code oficial e SAF-T (AO) validado.',
    description:
      'Emita faturas, faturas-recibo e guias de transporte com assinatura digital em tempo real, em total conformidade com o Decreto 71/25.',
    primary: { label: 'Conhecer a conformidade', target: 'conformidade-agt' },
    secondary: { label: 'Ver soluções', target: 'solucoes' },
    gradient: 'from-emerald-950 via-slate-900 to-slate-950',
  },
  {
    id: 'pos',
    tag: 'Ponto de Venda Kudiba',
    title: 'As suas vendas não param sem internet.',
    subtitle: 'Fature e imprima talões no balcão, mesmo com a rede indisponível.',
    description:
      'O POS Kudiba continua a operar offline e sincroniza automaticamente os documentos assim que a ligação é restabelecida. Ideal para lojas e províncias com sinal instável.',
    primary: { label: 'Explorar o POS', target: 'solucoes' },
    secondary: { label: 'Simular poupança', target: 'calculadora' },
    gradient: 'from-teal-950 via-slate-900 to-slate-950',
  },
  {
    id: 'gestao',
    tag: 'ERP Modular em Kwanzas',
    title: 'Toda a gestão da empresa no mesmo sítio.',
    subtitle: 'Faturação, stocks, salários, contabilidade e tesouraria integrados.',
    description:
      'Subscrições faturadas a 100% em AOA, com atualizações legais incluídas e apoio direto de uma equipa técnica em Angola.',
    primary: { label: 'Falar com um consultor' },
    secondary: { label: 'Consultar planos', target: 'planos' },
    gradient: 'from-slate-900 via-emerald-950 to-slate-950',
  },
];

const pillars = [
  { label: 'Moeda operacional', value: 'Kwanza (AOA)' },
  { label: 'Ponto de venda', value: 'Vende offline' },
  { label: 'Fiscalidade', value: 'SAF-T (AO) 1.01' },
  { label: 'Arquitetura', value: 'Multi-Filial' },
];

const SlideVisual: React.FC<{ id: SlideId }> = ({ id }) => {
  if (id === 'fiscal') {
    return (
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-5 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fatura Comercial</p>
            <p className="mt-0.5 text-sm font-extrabold">FT 2026/000184 · AGT</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Validada
          </span>
        </div>
        <div className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Cliente</span><span className="font-bold text-slate-900">Comércio Nova Esperança, Lda</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>NIF</span><span className="font-mono font-bold text-slate-900">5418290192</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Total em Kwanzas</span><span className="font-mono font-bold text-emerald-800">1.245.000,00 Kz</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-md bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
            <QrCode className="h-4 w-4 text-emerald-700" /> QR Code Fiscal Oficial
          </div>
          <span className="font-mono text-[10px] text-slate-400">4C9A · 71/25</span>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          Assinatura digital RSA-2048 encadeada
        </div>
      </div>
    );
  }

  if (id === 'pos') {
    return (
      <div className="w-full max-w-md space-y-3">
        <div className="rounded-lg border border-white/10 bg-white/95 p-5 text-slate-900 shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terminal de Caixa 03</p>
              <p className="mt-0.5 text-sm font-extrabold">Fecho em curso</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-slate-100 p-3">
              <p className="text-[10px] font-semibold text-slate-500">Vendas do dia</p>
              <p className="mt-1 font-mono text-base font-bold text-slate-900">845.500 Kz</p>
            </div>
            <div className="rounded-md bg-slate-100 p-3">
              <p className="text-[10px] font-semibold text-slate-500">Talões emitidos</p>
              <p className="mt-1 font-mono text-base font-bold text-slate-900">64</p>
            </div>
          </div>
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800">
            Documentos guardados localmente e sincronização automática ao regressar a rede.
          </p>
        </div>
        <div className="ml-auto w-4/5 rounded-md border border-white/10 bg-slate-800/80 p-4 text-white">
          <div className="mx-auto mb-3 h-1 w-16 rounded-full bg-slate-600" />
          <p className="text-center font-mono text-[11px]">KUDIBA POS · TALÃO 80mm</p>
          <div className="my-2 border-t border-dashed border-slate-600" />
          <p className="font-mono text-[10px] text-slate-300">FT 000184 ......... 24.500 Kz</p>
          <p className="font-mono text-[10px] text-slate-300">FR 000092 ......... 12.000 Kz</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-white/10 bg-white p-5 text-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-emerald-700" />
          <span className="text-sm font-extrabold">Painel de Controlo Executivo</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> Operação ativa
        </span>
      </div>
      <div className="mt-4 rounded-md bg-slate-50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Faturação consolidada · 2026</p>
        <p className="mt-1 font-mono text-2xl font-black text-slate-900">12.450.000 <span className="text-sm text-slate-500">Kz</span></p>
        <p className="mt-1 text-[10px] text-slate-500">184 documentos assinados digitalmente</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Stocks', value: 'CMP' },
          { label: 'Salários', value: 'IRT/INSS' },
          { label: 'Caixas', value: 'Abertos' },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-slate-200 p-3">
            <p className="text-[10px] text-slate-500">{item.label}</p>
            <p className="mt-1 text-xs font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900">
        <FileCheck className="h-4 w-4 shrink-0 text-emerald-700" />
        Atualizações fiscais incluídas na subscrição.
      </div>
    </div>
  );
};

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDemo, onOpenLogin }) => {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  useEffect(() => {
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 9000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePrimary = () => {
    if (slide.primary.target) {
      const el = document.getElementById(slide.primary.target);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      onOpenDemo();
    }
  };

  const handleSecondary = () => {
    const el = document.getElementById(slide.secondary.target);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="topo" className="bg-slate-100 py-6 dark:bg-slate-950 sm:py-8">
      <div className="landing-container">
        <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${slide.gradient} text-white shadow-xl`}>
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative grid grid-cols-1 items-center gap-8 px-6 py-12 pb-40 sm:px-10 sm:pb-32 lg:grid-cols-12 lg:px-14 lg:py-16 lg:pb-28">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                {slide.tag}
              </span>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-3 text-lg font-medium text-emerald-200">{slide.subtitle}</p>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">{slide.description}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrimary}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-wide text-slate-900 transition hover:bg-emerald-50"
                >
                  {slide.primary.label} <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleSecondary}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:border-white hover:bg-white/10"
                >
                  {slide.secondary.label}
                </button>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="ml-1 text-xs font-semibold text-slate-300 underline underline-offset-4 transition hover:text-white"
                >
                  Já é cliente? Iniciar sessão
                </button>
              </div>
            </div>
            <div className="hidden justify-center lg:col-span-5 lg:flex">
              <SlideVisual id={slide.id} />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-slate-950/50">
            <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-4 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-14">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                {pillars.map((pillar) => (
                  <div key={pillar.label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{pillar.label}</p>
                    <p className="mt-0.5 text-xs font-bold text-white">{pillar.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActive((active - 1 + slides.length) % slides.length)}
                  aria-label="Destaque anterior"
                  className="rounded-full border border-white/20 p-2 transition hover:bg-white/10"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  {slides.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActive(index)}
                      aria-label={`Ver destaque ${index + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        active === index ? 'w-6 bg-emerald-400' : 'w-2 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActive((active + 1) % slides.length)}
                  aria-label="Destaque seguinte"
                  className="rounded-full border border-white/20 p-2 transition hover:bg-white/10"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
