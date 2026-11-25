import React, { useState } from 'react';
import { X, Send, CheckCircle2, MessageCircle, Building2, Phone, User } from 'lucide-react';

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: string;
}

export const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
  isOpen,
  onClose,
  initialPlan,
}) => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [nif, setNif] = useState('');
  const [phone, setPhone] = useState('');
  const [province, setProvince] = useState('Luanda');
  const [interest, setInterest] = useState(initialPlan || 'Demonstração Geral do Kudiba ERP');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `*Olá, equipa Kudiba ERP!*\n\nGostaria de agendar uma demonstração / obter cotação.\n\n*Nome:* ${name || 'Não informado'}\n*Empresa:* ${company || 'Não informada'}\n*NIF:* ${nif || 'Não informado'}\n*Telemóvel:* ${phone || 'Não informado'}\n*Província:* ${province}\n*Interesse / Plano:* ${interest}`
    );
    // WhatsApp direct link (can be customized with real company number, default placeholder +244 923 000 000)
    window.open(`https://wa.me/244923000000?text=${text}`, '_blank');
  };

  const resetAndClose = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {submitted ? 'Demonstração Solicitada!' : 'Agendar Demonstração ou Cotação'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kudiba ERP • Resposta rápida da nossa equipa comercial em Angola
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                Os seus dados foram registados com sucesso!
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                Para um atendimento prioritário e imediato, pode enviar a mensagem formatada diretamente para o nosso WhatsApp:
              </p>
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-700 transition"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Conversar no WhatsApp Agora</span>
              </button>
              <button
                type="button"
                onClick={resetAndClose}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline mt-2 block mx-auto"
              >
                Fechar janela
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Responsável / Decisor *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Manuel Silva"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nome da Empresa *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Ex: Supermercado Aliança, Lda"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    NIF da Empresa (Opcional)
                  </label>
                  <input
                    type="text"
                    value={nif}
                    onChange={(e) => setNif(e.target.value)}
                    placeholder="Ex: 5418290192"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Telemóvel / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+244 923 000 000"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Província *
                  </label>
                  <select
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="Luanda">Luanda</option>
                    <option value="Benguela">Benguela</option>
                    <option value="Huambo">Huambo</option>
                    <option value="Huíla">Huíla</option>
                    <option value="Cabinda">Cabinda</option>
                    <option value="Cuanza Sul">Cuanza Sul</option>
                    <option value="Outra Província">Outra Província</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Interesse Principal / Plano
                </label>
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  placeholder="Ex: Kudiba PME Integrado ou POS Offline"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/25 hover:bg-emerald-700 active:scale-[0.99] transition"
                >
                  <Send className="h-4 w-4" />
                  <span>Submeter Pedido de Demonstração</span>
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 pt-1">
                Ao submeter, os seus dados são protegidos nos termos da Lei de Proteção de Dados de Angola (Lei 22/11).
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
