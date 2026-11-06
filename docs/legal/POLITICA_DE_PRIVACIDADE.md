# POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS PESSOAIS
## KUDIBA ERP — EM CONFORMIDADE COM A LEI N.º 22/11 DE ANGOLA

**Versão:** 1.0 (2026)  
**Responsável pelo Tratamento:** YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA  
**Autoridade Reguladora de Referência:** Agência de Proteção de Dados (APD — Angola)  
**Data de Entrada em Vigor:** 1 de Janeiro de 2026  

---

### 1. COMPROMISSO DE PRIVACIDADE E SEGURANÇA

A **YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA**, na qualidade de proprietária e fornecedora da plataforma **Kudiba ERP**, assume o compromisso fundamental de garantir a privacidade, confidencialidade, integridade e proteção dos dados pessoais de todos os utilizadores, clientes, colaboradores e parceiros comerciais que interagem com o sistema.

A presente Política de Privacidade foi elaborada em estrita conformidade com a **Lei n.º 22/11, de 17 de Junho — Lei da Protecção de Dados Pessoais da República de Angola**, bem como com as normas complementares emitidas pela **Agência de Proteção de Dados (APD)**.

---

### 2. PRINCÍPIOS FUNDAMENTAIS DO TRATAMENTO

O tratamento de dados pessoais no âmbito do Kudiba ERP rege-se pelos seguintes princípios basilares:
1. **Princípio da Licitude e Boa-Fé:** Os dados são tratados para finalidades legítimas, determinadas, explícitas e decorrentes da execução contratual e do cumprimento de obrigações fiscais e laborais legais.
2. **Princípio da Proporcionalidade e Minimização:** Apenas são recolhidos e processados os dados estritamente necessários para a prestação dos serviços de faturação, gestão de stocks, tesouraria, processamento salarial e contabilidade.
3. **Princípio da Exatidão:** O sistema disponibiliza mecanismos permanentes para que os dados inexatos sejam prontamente retificados ou atualizados pelos respetivos responsáveis.
4. **Princípio da Segurança e Confidencialidade:** Implementação de medidas técnicas de ponta (encriptação TLS 1.3, hashing criptográfico de passwords em Argon2id e controlo granular de acessos por perfil).

---

### 3. DADOS RECOLHIDOS E FINALIDADES DO PROCESSAMENTO

O Kudiba ERP processa dados em duas dimensões distintas:

#### A. Dados da Empresa e Utilizadores da Subscrição
- **Dados Cadastrais:** Denominação Social, Nome Comercial, NIF, Endereço da Sede, Contacto Telefónico e E-mail Institucional.
- **Credenciais de Acesso:** E-mails de utilizadores, nomes dos colaboradores, perfis de função (RBAC) e registos de palavra-passe protegidos por funções de derivação criptográfica irreversíveis (Argon2id).
- **Finalidade:** Autenticação, gestão de sessões seguras, faturação do serviço SaaS, atribuição de privilégios de acesso e suporte técnico.

#### B. Dados Operacionais e Fiscais de Terceiros (Clientes e Fornecedores)
- **Dados de Faturação:** NIF de clientes singulares e coletivos, nomes comerciais, moradas fiscais, artigos adquiridos e valores transacionados.
- **Finalidade Obrigatória:** Emissão legal de faturas e recibos em cumprimento do Decreto Presidencial n.º 292/18 e Decreto Presidencial n.º 71/25, comunicação à AGT e geração do ficheiro oficial SAF-T (AO).
- *Nota sobre Consumidor Final:* Para operações com clientes não identificados (`999999999`), o Kudiba ERP não exige nem regista dados de morada pessoal, garantindo a privacidade das transações ao balcão.

#### C. Dados de Recursos Humanos e Salários (Módulo Payroll)
- **Dados dos Colaboradores:** Nome completo, Bilhete de Identidade (BI), NIF, N.º de Segurança Social (INSS), IBAN para pagamento, categoria profissional, vencimento base e deduções legais.
- **Finalidade Obrigatória:** Processamento salarial mensal, cálculo e retenção na fonte do Imposto sobre o Rendimento do Trabalho (IRT), liquidação das contribuições para o INSS e emissão do mapa de remunerações.

---

### 4. SEGURANÇA E PROTEÇÃO TÉCNICA DA INFORMAÇÃO

O Kudiba ERP implementa uma arquitetura de segurança perimétrica em profundidade (*Defense in Depth*):
1. **Comunicação Segura (HTTPS / TLS 1.3):** Todo o tráfego entre o navegador do utilizador e os servidores é encriptado com chaves assimétricas modernas e cabeçalhos de proteção HSTS (*Strict-Transport-Security*).
2. **Tokens e Cookies HttpOnly:** As sessões de utilizador utilizam cookies protegidos com as diretivas `HttpOnly`, `Secure` e `SameSite=Lax`, impedindo a extração indevida de credenciais via ataques XSS (*Cross-Site Scripting*).
3. **Isolamento Multi-Inquilino (Multi-Tenant Isolation):** Cada empresa subscritora possui os seus registos estritamente segregados através de chaves únicas de `tenant_id` e políticas de isolamento ao nível do banco de dados (*Row-Level Security*), sendo tecnicamente inviável o acesso cruzado entre empresas distintas.
4. **Trilha de Auditoria Universal:** Todas as ações sensíveis (emissões de faturas, anulações, transferências de caixa e processamentos de salário) ficam associadas ao identificador do operador, endereço IP e carimbo temporal imutável (*Timestamp*).

---

### 5. PARTILHA DE DADOS COM TERCEIROS E ENTIDADES OFICIAIS

A YHADI SOLUÇÕES não comercializa, não aluga e não cede dados a terceiros para fins de marketing ou publicidade.

A transmissão de dados ocorre estritamente nos seguintes casos legalmente mandatados:
1. **Administração Geral Tributária (AGT):** Transmissão de documentos fiscais eletrónicos em tempo real ou periódicos via webservices e envio mensal do ficheiro SAF-T (AO);
2. **Instituto Nacional de Segurança Social (INSS):** Transmissão de folhas de remunerações e contribuições dos colaboradores;
3. **Ordens Judiciais:** Em cumprimento de mandados judiciais válidos emitidos por órgãos jurisdicionais competentes da República de Angola.

---

### 6. PRAZOS DE RETENÇÃO E CONSERVAÇÃO

1. **Dados Fiscais e Contabilísticos:** Em cumprimento das disposições do Código Comercial de Angola e do Código do IVA, os documentos de suporte fiscal (faturas, recibos, extratos e lançamentos do PGC) são mantidos em arquivo eletrónico seguro pelo período legal mínimo de **10 (dez) anos civis**.
2. **Dados de Utilizadores Inativos:** Dados de contas encerradas são desativados de imediato para fins de autenticação, sendo os dados cadastrais mantidos apenas pelo tempo estritamente exigido para cumprimento de obrigações legais e regulatórias.

---

### 7. DIREITOS DOS TITULARES DOS DADOS

Nos termos da Lei n.º 22/11 de Angola, os titulares dos dados têm direito a:
- **Direito de Informação e Acesso:** Saber quais os dados pessoais recolhidos e a forma como são processados;
- **Direito de Retificação:** Solicitar a correção imediata de dados cadastrais incompletos ou inexatos;
- **Direito de Exportação / Portabilidade:** Descarregar a qualquer momento a totalidade dos seus registos no formato universal SAF-T (AO) ou tabelas interoperáveis;
- **Direito de Oposição:** Opor-se a tratamentos que não decorram de obrigações fiscais ou laborais legais imperativas.

Para exercer qualquer dos direitos acima, o titular ou o Administrador da empresa pode contactar o Encarregado de Proteção de Dados através do canal oficial:
- **E-mail:** `privacidade@kudiba.ao` ou `suporte@kudiba.ao`
- **Endereço Postal:** Luanda, República de Angola.

---

### 8. ATUALIZAÇÕES DA POLÍTICA

A YHADI SOLUÇÕES reserva-se o direito de atualizar a presente Política de Privacidade sempre que ocorram alterações legislativas, regulamentares ou avanços tecnológicos na plataforma. Quaisquer modificações substantivas serão notificadas aos utilizadores através de aviso destacado no painel inicial do Kudiba ERP.
