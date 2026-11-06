# POLÍTICA DE COLECTA E TRATAMENTO DE DADOS PESSOAIS
**KUDIBA ERP — SISTEMA INTEGRADO DE GESTÃO EMPRESARIAL**

**Documento:** Regulamento Interno de Tratamento de Dados e Acordo de Processamento de Dados (DPA)  
**Versão:** 1.0 / 2026  
**Data de Entrada em Vigor:** 1 de Janeiro de 2026  
**Última Actualização:** 6 de Novembro de 2026  
**Enquadramento Legal:** Lei n.º 22/11, de 11 de Dezembro (Lei da Protecção de Dados Pessoais da República de Angola) perante a Agência de Protecção de Dados (APD), e Decreto Presidencial n.º 71/25 (Regime da Facturação Electrónica e Facturação em Software Certificado pela AGT).

---

## 1. IDENTIFICAÇÃO DO RESPONSÁVEL E DO SUBCONTRATANTE

- **Fornecedora da Plataforma (Subcontratante / Operador Técnico):**  
  **YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA**, sociedade comercial constituída sob as leis de Angola, com NIF `5417089123`, sede na Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar, Luanda, República de Angola.
- **Cliente Subscritor (Responsável pelo Tratamento / Titular da Conta):**  
  A entidade colectiva ou singular que subscreve o Kudiba ERP, a quem compete determinar as finalidades e os meios de tratamento dos dados dos seus próprios colaboradores, clientes e fornecedores.
- **Encarregado da Protecção de Dados (DPO):**  
  Gabinete de Privacidade e Segurança da Informação: `privacidade@kudiba.ao` / `dpo@kudiba.ao`.

---

## 2. PRINCÍPIOS FUNDAMENTAIS DO TRATAMENTO (ART. 3.º DA LEI N.º 22/11)

Todo e qualquer tratamento de dados realizado pela plataforma Kudiba ERP orienta-se rigorosamente pelos princípios reitores da Lei n.º 22/11:

1. **Princípio da Legalidade:** Os dados só são recolhidos e processados com base no consentimento do titular, no cumprimento de contrato ou no estrito cumprimento de obrigações jurídicas impostas pelo Estado Angolano.
2. **Princípio da Finalidade:** Os dados destinam-se exclusivamente aos fins de operação comercial, gestão de recursos humanos, liquidação tributária e controlo interno empresarial expressos no acto de recolha.
3. **Princípio da Proporcionalidade e Minimização:** Apenas são recolhidos os dados estritamente necessários à prestação dos serviços contratados e às regras tributárias da AGT.
4. **Princípio da Veracidade e Exactidão:** Mecanismos de auditoria e actualização garantem que os dados incorrectos ou desactualizados sejam retificados sem demora.
5. **Princípio da Segurança e Confidencialidade:** Protecção activa com cifra criptográfica em trânsito (TLS 1.3) e em repouso, políticas de privilégio mínimo e isolamento rigoroso por inquilino (*Multi-Tenant Row-Level Security*).

---

## 3. CATEGORIAS DE DADOS RECOLHIDOS E SUAS FINALIDADES ESPECÍFICAS

### A. Dados do Subscritor e Utilizadores Operacionais (Gestão de Acesso)
- **Dados:** Nome completo, correio electrónico corporativo, telefone, credenciais de acesso (armazenadas exclusivamente sob hash irreversível Argon2id), perfis de permissão (RBAC) e endereço IP de autenticação.
- **Finalidade:** Gestão de sessão segura, emissão de JWT, auditoria de acessos e prevenção contra acessos não autorizados.

### B. Dados de Clientes Finais e Compradores (Módulo de Facturação e POS)
- **Dados:** Nome ou Denominação Social, NIF (Número de Identificação Fiscal), morada de faturação, cidade, telefone e e-mail.
- **Venda a Consumidor Final:** Nas transacções de balcão a dinheiro/TPA onde o cliente não exija NIF nominal, o sistema aplica a identificação fiscal colectiva simplificada (`999999999` — Consumidor Final), sem exigir nem reter dados de identificação civil privada desnecessários.
- **Base Legal:** Cumprimento de dever jurídico-fiscal imperativo perante a Administração Geral Tributária (AGT), nos termos do Regime Jurídico das Facturas (Decreto Presidencial n.º 292/18) e Regime de Facturação Electrónica (Decreto Presidencial n.º 71/25).

### C. Dados de Trabalhadores e Colaboradores (Módulo de Recursos Humanos e Salários - KudibaPayroll)
- **Dados:** Nome, número do Bilhete de Identidade / Passaporte, NIF pessoal, NISS (Segurança Social), cargo, vencimento-base, subsídios, IBAN bancário, registos de assiduidade e histórico de faltas/férias.
- **Finalidade:** Processamento e emissão de folhas de pagamento, apuramento e liquidação do Imposto sobre o Rendimento do Trabalho (IRT), apuramento de contribuições ao Instituto Nacional de Segurança Social (INSS) e cumprimento do Código de Trabalho de Angola.
- **Garantias Especiais:** Estes dados gozam de restrição de acesso por privilégio estrito (`payroll:manage`, `payroll:approve`), inacessíveis a operadores de caixa ou operadores de armazém.

### D. Dados Contabilísticos e Registos Financeiros (KudibaTreasury & KudibaAccounting)
- **Dados:** Extratos de movimentação bancária, caixas físicas, lançamentos do razão geral no PGC (Plano Geral de Contabilidade) de Angola e exportação anual do ficheiro SAF-T AO (XML).

---

## 4. CICLO DE VIDA, RETENÇÃO E ARQUIVO LEGAL OBRIGATÓRIO

1. **Arquivo Fiscal Obrigatório de 10 Anos:**  
   Em estrita obediência ao Código Comercial de Angola, ao Código Geral Tributário e aos regulamentos da AGT, todos os documentos fiscais emitidos (Facturas, Facturas-Recibo, Notas de Crédito, Notas de Débito e guias), bem como as respectivas cadeias de assinaturas digitais RSA-2048, são arquivados de forma inalterável pelo período mínimo legal de **10 (dez) anos civis**.
2. **Dados de Utilizadores Inactivos:**  
   Contas de operadores revogadas ou desativadas são suspensas de imediato, mantendo-se os rastos de auditoria (*Audit Trail*) estritamente necessários para demonstrar a conformidade das operações fiscais passadas realizadas pelo titular da sessão.
3. **Eliminação de Dados Não Vinculados a Obrigações Fiscais:**  
   Findo o contrato de prestação de serviços e expirados os prazos legais de auditoria ou defesa em litígios, os dados operacionais não fiscais serão definitiva e irreversivelmente expurgados dos servidores ou anonimizados.

---

## 5. MEDIDAS TÉCNICAS E ORGANIZATIVAS DE SEGURANÇA DA INFORMAÇÃO

A **YHADI SOLUÇÕES** adopta uma arquitectura de segurança em profundidade:

1. **Criptografia e Chaves Fiscais:**
   - Comunicações encriptadas perimetricamente em trânsito com protocolos **TLS 1.3 / HTTPS**.
   - Assinatura fiscal de cada factura por algoritmo assimétrico **RSA-2048 com SHA-256**, validada sob o Certificado AGT n.º `FE/528/AGT/2026`.
   - Chaves privadas fiscais protegidas em módulos de segurança com variáveis de ambiente restritas e segregação de segredos (*Secrets Management*).
2. **Isolamento de Dados Multi-Inquilino (Multi-Tenancy):**
   - Cada registo na base de dados possui identificador único e indexado de `tenant_id`. As consultas de cada cliente são isoladas logicamente através de políticas ao nível de linha (RLS) e cláusulas restritivas nas camadas de dados, impedindo qualquer acesso transfronteiriço entre inquilinos.
3. **Autenticação e Senhas:**
   - Armazenamento de credenciais protegido pelo padrão **Argon2id** (resistente a ataques de força bruta por GPU/ASIC).
   - Sessões temporárias com tokens JWT criptografados com tempo de expiração curto e renovação controlada por refresh token.
4. **Cópias de Segurança (Backups):**
   - Backups incrementais e completos diários cifrados com AES-256, armazenados em nós geograficamente redundantes com planos de continuidade de negócio e recuperação de desastres (*Disaster Recovery*).

---

## 6. DIREITOS DOS TITULARES DOS DADOS (LEI N.º 22/11)

Nos termos dos artigos da Lei da Protecção de Dados Pessoais, os titulares gozam dos seguintes direitos perante o Responsável pelo Tratamento:

- **Direito de Informação e Acesso:** Saber quais dados pessoais estão a ser objecto de tratamento e obter uma cópia inteligível dos mesmos.
- **Direito de Rectificação:** Solicitar a correção imediata de dados incompletos, inexactos ou desactualizados.
- **Direito de Bloqueio ou Eliminação:** Requerer a supressão de dados que tenham sido recolhidos ilicitamente ou que se tenham tornado desnecessários para a finalidade original, **ressalvados os dados cuja preservação seja imposta por dever legal fiscal (AGT) ou judicial**.
- **Direito de Oposição:** Opor-se, a qualquer momento e por motivos legítimos, ao tratamento dos seus dados para finalidades não essenciais ao serviço contratado.
- **Canal de Exercício de Direitos:** Os pedidos devem ser submetidos via e-mail formal para `privacidade@kudiba.ao` ou entregues fisicamente na sede social da Yhadi Soluções em Luanda.

---

## 7. POLÍTICA DE TRANSFERÊNCIA DE DADOS E SUBCONTRATAÇÃO

1. **Não Comercialização de Dados:** A Yhadi Soluções **não vende, não aluga e não comercializa** qualquer dado pessoal ou mercantil inserido pelos clientes na plataforma Kudiba ERP.
2. **Prestadores de Infraestrutura Cloud:** Os dados residem em centros de processamento de dados com certificação Tier III/IV e ISO/IEC 27001 e SOC 2, cumprindo padrões rigorosos de confidencialidade técnica.
3. **Comunicação a Órgãos Públicos:** O envio de dados de facturação ou mapas salariais à Administração Geral Tributária (AGT) e ao INSS é efectuado estritamente conforme as obrigações declarativas do próprio Cliente ou mediante ordem judicial emanada por Tribunal competente da República de Angola.

---

## 8. CONTACTO E RECLAMAÇÃO PERANTE A APD

Qualquer questão, esclarecimento de segurança ou reclamação relacionada com a protecção de dados pode ser endereçada a:

- **E-mail:** `privacidade@kudiba.ao`
- **Endereço Postal:** Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar, Luanda, Angola.
- **Autoridade de Controlo:** Sem prejuízo dos canais internos, o titular assiste-se do direito de apresentar reclamação directamente junto da **Agência de Protecção de Dados (APD)** da República de Angola.
