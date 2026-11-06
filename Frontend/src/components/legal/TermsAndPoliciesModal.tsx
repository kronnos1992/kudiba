import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Scale,
  Printer,
  X,
  CheckCircle2,
  Lock,
  Building2,
  Calendar,
} from 'lucide-react';

interface TermsAndPoliciesModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal';
  onAccept?: () => void;
  showAcceptButton?: boolean;
}

export const TermsAndPoliciesModal: React.FC<TermsAndPoliciesModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'terms',
  onAccept,
  showAcceptButton = false,
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'data_processing' | 'subscription' | 'fiscal'>(defaultTab);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Documentação Jurídica & Termos Oficiais
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kudiba ERP • YHADI SOLUÇÕES (SU), LDA • Certificação AGT N.º FE/528/AGT/2026
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Imprimir documento"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="px-4 sm:px-6 pt-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 sm:gap-4 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'terms'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Termos e Condições de Uso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'privacy'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Política de Privacidade (Lei 22/11)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('data_processing')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'data_processing'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Coleta &amp; Tratamento de Dados</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subscription')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'subscription'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Contrato de Subscrição SaaS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fiscal')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'fiscal'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Conformidade Fiscal (Dec. 71/25)</span>
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans select-text">
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-900 dark:text-emerald-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Entidade Emissora: YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-80">
                  <Calendar className="w-3.5 h-3.5" /> Edição 2026 • Luanda, Angola
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  1. Objeto e Licenciamento
                </h4>
                <p>
                  O Kudiba ERP é uma plataforma multi-inquilino de gestão empresarial (SaaS) que compreende os módulos de Facturação Electrónica, Ponto de Venda (POS), Inventário, Tesouraria, Recursos Humanos/Folha Salarial e Contabilidade Geral (PGC). A subscrição do serviço confere ao utilizador uma licença de uso pessoal, não exclusiva, intransmissível e temporária, sujeita ao pagamento regular da subscrição aplicável.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  2. Responsabilidade do Utilizador e Integridade Fiscal
                </h4>
                <p>
                  O Cliente é o único responsável pela veracidade e licitude dos dados cadastrais inseridos (NIF da empresa, denominação social, morada e enquadramento fiscal no IVA), bem como pela correta parametrização das taxas de imposto e isenções de bens e serviços comercializados. É expressamente proibida a utilização da plataforma para emissão simulada, fraude fiscal ou evasão tributária.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  3. Imutabilidade dos Registos Fiscais (Dec. Presidencial 71/25)
                </h4>
                <p>
                  Em cumprimento estrito das disposições do Regime Jurídico das Facturas (Decreto Presidencial 292/18) e do Regulamento da Facturação Electrónica (Decreto Presidencial 71/25), todos os documentos emitidos no Kudiba ERP são cifrados e assinados digitalmente através do algoritmo RSA-2048 PKCS#1 v1.5 com encadeamento de hash SHA-256 e geração de QR Code de validação. Não é permitida a eliminação ou alteração retroativa de faturas já emitidas, devendo qualquer retificação ser operada por Nota de Crédito nos termos da lei.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  4. Arquivo Legal e Exportação SAF-T (AO)
                </h4>
                <p>
                  Nos termos do Código Comercial de Angola, os registos de suporte fiscal e contabilístico são mantidos em arquivo eletrónico seguro pelo período legal de 10 (dez) anos civis. O Cliente pode exportar e descarregar a qualquer momento a totalidade dos seus registos no formato oficial SAF-T (AO) v1.01_01, para submissão mensal no Portal de Contribuintes da AGT.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  5. Nível de Disponibilidade e Suporte
                </h4>
                <p>
                  A plataforma garante um índice de disponibilidade de serviço (SLA) de 99,5%, contando com mecanismos automáticos de redundância e cópias de segurança diárias encriptadas. Na eventualidade de falha de conectividade ou indisponibilidade dos servidores tributários, o sistema opera de forma contínua em modo de contingência fiscal, sincronizando os registos assim que a rede for restabelecida.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-sky-50/80 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-xl text-sky-900 dark:text-sky-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Proteção de Dados: Lei n.º 22/11 da República de Angola
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-80">
                  Diretrizes da APD (Agência de Proteção de Dados)
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  1. Tratamento Lícito e Finalidades Estritas
                </h4>
                <p>
                  A YHADI SOLUÇÕES trata dados pessoais no Kudiba ERP exclusivamente para efeitos de autenticação, faturação, processamento de remunerações (IRT e INSS), cumprimento de obrigações tributárias oficiais e segurança da informação. Não realizamos venda, aluguer ou partilha de dados pessoais com terceiros para fins de marketing ou publicidade.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  2. Dados de Clientes no Ponto de Venda e "Consumidor Final"
                </h4>
                <p>
                  Nas vendas a dinheiro e operações de balcão atribuídas a "Consumidor Final" (NIF 999999999), o sistema não exige nem armazena moradas pessoais ou dados residenciais, assegurando a privacidade das transações diárias de retalho e conformidade com as normas da AGT.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  3. Segurança Técnica e Cookies Protegidos
                </h4>
                <p>
                  Todas as comunicações com a rede Kudiba são encriptadas via HTTPS/TLS 1.3 com cabeçalhos HSTS de proteção contra interceção de dados. A autenticação de sessões emprega cookies de segurança protegidos com as diretivas HttpOnly, Secure e SameSite, prevenindo vulnerabilidades de extração ou roubo de sessão.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  4. Isolamento Multi-Empresa (Multi-Tenant)
                </h4>
                <p>
                  Os dados de cada organização são rigorosamente isolados na base de dados por meio de políticas de Row-Level Security (RLS) e identificadores segregados, garantindo que nenhum utilizador ou empresa tenha acesso a registos de outra entidade.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  5. Direitos dos Titulares de Dados
                </h4>
                <p>
                  Nos termos da Lei n.º 22/11 de Angola, os titulares dos dados têm o direito de aceder, solicitar retificação ou exigir a exportação dos seus dados pessoais através do canal oficial de privacidade: <strong className="text-slate-900 dark:text-white">privacidade@kudiba.ao</strong>.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'data_processing' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-emerald-900 dark:text-emerald-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-600" /> Regulamento de Coleta e Tratamento de Dados (DPA)
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-80">
                  Lei n.º 22/11 • APD Angola
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  1. Qualificação das Partes no Tratamento
                </h4>
                <p>
                  A <strong>YHADI SOLUÇÕES, LDA</strong> atua como Subcontratante / Operador Técnico da infraestrutura cloud, enquanto a entidade Subscritora atua como Responsável pelo Tratamento perante os seus trabalhadores, clientes e fornecedores, determinando as finalidades e legitimidade das informações inseridas.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  2. Dados de Recursos Humanos e Salários (KudibaPayroll)
                </h4>
                <p>
                  O processamento de salários compreende a recolha do Nome, NIF, Bilhete de Identidade, NISS, IBAN e remunerações. Estes dados são tratados exclusivamente para apuramento do Imposto sobre o Rendimento do Trabalho (IRT), segurança social (INSS) e cumprimento do Código de Trabalho, com restrição de acesso por privilégios específicos (<code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">payroll:manage</code>).
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  3. Dados de Faturação e Venda a Consumidor Final
                </h4>
                <p>
                  Nas transações com clientes em balcão/POS sem exigência de fatura nominal com NIF individualizado, o sistema adota por padrão a identificação fiscal agregada <strong className="font-mono">999999999 (Consumidor Final)</strong>, evitando a coleta e retenção intrusiva de dados pessoais de cidadãos no ato de compra.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  4. Medidas Técnicas de Cifra e Isolamento RLS
                </h4>
                <p>
                  Os registos de dados de cada inquilino são separados com isolamento estrito via identificador de tenant e regras de base de dados (Row-Level Security). As senhas de utilizador são convertidas sob o padrão criptográfico Argon2id. Todas as comunicações via browser e APIs utilizam exclusivamente conexões cifradas TLS 1.3.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  5. Retenção Legal e Arquivo de 10 Anos
                </h4>
                <p>
                  Por força imperativa do Código Comercial e do Decreto Presidencial 71/25, os registos fiscais e assinaturas digitais RSA-2048 são guardados em custódia arquivística imutável pelo prazo legal de 10 anos. Ao término da vigência da subscrição, a exportação integral é assegurada ao subscritor antes do expurgo de credenciais ativas.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-blue-900 dark:text-blue-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" /> Contrato de Subscrição de Software SaaS
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-80">
                  YHADI SOLUÇÕES (SU), LDA • NIF 5417089123
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  1. Objeto e Âmbito de Licenciamento
                </h4>
                <p>
                  A YHADI SOLUÇÕES concede ao Subscritor uma licença de uso do software Kudiba ERP na modalidade SaaS, não exclusiva e intransmissível, abrangendo os módulos subscritos (Facturação, Gestão de Stock, Tesouraria &amp; Caixa, Recursos Humanos, Contabilidade e Integrações), incluindo manutenção corretiva e atualizações regulamentares fiscais da AGT.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  2. Garantia de Conformidade AGT (FE/528/AGT/2026)
                </h4>
                <p>
                  A Fornecedora garante que o Kudiba ERP encontra-se devidamente homologado pela Administração Geral Tributária de Angola sob o certificado n.º <strong>FE/528/AGT/2026</strong>. Toda emissão cumpre o encadeamento de séries e regras de assinatura RSA-2048 / SHA-256 impostas pelo Decreto Presidencial 71/25.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  3. Nível de Disponibilidade (SLA) e Continuidade
                </h4>
                <p>
                  É assegurado um nível de disponibilidade mensal de 99,5%, com backups diários encriptados e capacidade de operação em contingência fiscal local quando da ausência de internet ou indisponibilidade temporária de webservices da AGT.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  4. Pagamento e Vigência
                </h4>
                <p>
                  A subscrição vigora pelo período contratado (mensal ou anual), sendo liquidada em Kwanzas (AOA) via transferência bancária, Multicaixa Express ou meios integrados. O atraso no pagamento confere à fornecedora o direito de suspender a emissão de novos documentos, mantendo intacto o acesso aos arquivos para fins fiscais.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  5. Foro e Resolução de Litígios
                </h4>
                <p>
                  Para dirimir eventuais litígios resultantes do presente contrato, as partes elegem expressamente o foro da Comarca de Luanda, República de Angola, com expressa renúncia a qualquer outro.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'fiscal' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Software Certificado pela AGT: N.º FE/528/AGT/2026
                </span>
                <span className="flex items-center gap-1 text-[11px] opacity-80">
                  Decreto Presidencial 71/25
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  1. Homologação e Certificação Tributária
                </h4>
                <p>
                  O Kudiba ERP é oficialmente certificado pela Administração Geral Tributária (AGT) sob a licença de validação n.º <strong className="font-mono text-emerald-700 dark:text-emerald-400">FE/528/AGT/2026</strong>. Todo o motor de cálculo, regras de arredondamento comercial (arredondamento simétrico afastando de zero), taxas de IVA (14%, 7%, 5%, 0%) e códigos de isenção de M00 a M14 foram validados perante os padrões regulatórios nacionais.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  2. Assinatura Digital e Encadeamento de Séries
                </h4>
                <p>
                  Cada documento emitido contém uma assinatura digital RSA-2048 exclusiva calculada a partir do documento imediatamente anterior da mesma série, formando uma cadeia ininterrupta que previne inserções clandestinas ou supressões de faturas. O talão impresso expõe claramente os 4 carateres de controlo e o QR Code oficial.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  3. Ficheiro SAF-T (AO) v1.01_01
                </h4>
                <p>
                  O ficheiro SAF-T de faturação gerado na plataforma respeita integralmente o esquema XSD oficial da AGT (Portaria n.º 1.01_01), permitindo a validação direta e sem erros na plataforma de auditoria do Ministério das Finanças.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1.5">
                  4. Conector em Tempo Real e Contingência
                </h4>
                <p>
                  O conector fiscal implementa a comunicação assíncrona por lote via webservices AGT (endpoint <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/sigt/fe/v1/registarFactura</code>) com captura de <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">requestID</code>. Na eventualidade de falha de ligação, os documentos são mantidos em contingência local e expedidos sem intervenção manual logo após a normalização.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Ao utilizar o Kudiba ERP, a sua empresa subscreve os presentes termos e a legislação angolana aplicável.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer w-full sm:w-auto text-center"
            >
              {showAcceptButton ? 'Cancelar' : 'Fechar'}
            </button>

            {showAcceptButton && (
              <button
                type="button"
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Li e Aceito as Condições</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
