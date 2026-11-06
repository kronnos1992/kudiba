# TERMOS E CONDIÇÕES GERAIS DE USO E SUBSCRIÇÃO
## KUDIBA ERP — SOFTWARE DE GESTÃO E FACTURAÇÃO ELECTRÓNICA CERTIFICADO

**Versão:** 1.0 (2026)  
**Entidade Titular e Fornecedora:** YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA  
**Certificação Tributária Oficial:** N.º FE/528/AGT/2026 (Administração Geral Tributária — Angola)  
**Data de Entrada em Vigor:** 1 de Janeiro de 2026  
**Jurisdição:** República de Angola  

---

### PREÂMBULO E ACEITAÇÃO DOS TERMOS

O presente contrato regula os termos e condições aplicáveis à subscrição, acesso e utilização da plataforma **Kudiba ERP** (doravante designada por "Kudiba", "Plataforma" ou "Sistema"), desenvolvida e disponibilizada pela **YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA**, pessoa coletiva angolana com sede em Luanda, Angola.

Ao subscrever o serviço, aceder à plataforma via web ou telemóvel, efetuar login ou clicar na caixa de verificação *"Li e aceito os Termos de Uso e a Política de Privacidade"*, a pessoa singular ou coletiva utilizadora (doravante designada por "Cliente", "Subscritor" ou "Utilizador") declara ter capacidade jurídica bastante e manifesta a sua aceitação integral, irrevogável e sem reservas de todas as cláusulas aqui estipuladas.

Caso não concorde com qualquer dos presentes termos, o Utilizador deve abster-se imediatamente de aceder, registar empresa ou utilizar o Kudiba ERP.

---

### CLÁUSULA 1.ª — DEFINIÇÕES E ÂMBITO DO SERVIÇO

1. **Kudiba ERP:** Solução tecnológica multi-inquilino (*SaaS — Software as a Service*) para gestão empresarial integrada, compreendendo os seguintes módulos licenciáveis:
   - **Kudiba Invoicing:** Motor fiscal certificado de emissão de faturas (FT), faturas-recibo (FR), notas de crédito (NC), notas de débito (ND) e guias de transporte/remessa (GT/GR), com geração de QR Code tributário e exportação do ficheiro SAF-T (AO);
   - **Kudiba POS:** Ponto de Venda e frente de caixa com emissão de talões térmicos (80mm), leitura X e fecho diário Z;
   - **Kudiba Inventory:** Gestão de múltiplos armazéns, controlo de stocks, cálculo de Custo Médio Ponderado (CMP) e catálogo de produtos;
   - **Kudiba Treasury:** Gestão de caixa, contas bancárias, reconciliação financeira e liquidação de contas correntes;
   - **Kudiba Payroll:** Processamento salarial, retenções na fonte de IRT, contribuições para o INSS e emissão de recibos de vencimento;
   - **Kudiba Accounting:** Contabilidade geral conforme o Plano Geral de Contabilidade (PGC) de Angola e emissão de Balancetes e Demonstrações Financeiras.
2. **AGT:** Administração Geral Tributária da República de Angola.
3. **Certificação Fiscal:** Validação oficial concedida pela AGT ao software Kudiba sob o número de validação `FE/528/AGT/2026`, atestando a sua plena conformidade com as regras de faturação vigentes em Angola.

---

### CLÁUSULA 2.ª — CONFORMIDADE FISCAL E LEGAL EM ANGOLA

1. O Kudiba ERP foi arquitetado em estrita conformidade com o ordenamento jurídico tributário e comercial de Angola, nomeadamente:
   - **Decreto Presidencial n.º 292/18:** Regime Jurídico das Facturas e Documentos Equivalentes;
   - **Decreto Presidencial n.º 71/25:** Regulamento da Facturação Electrónica e Comunicação em Tempo Real com a AGT;
   - **Código do Imposto sobre o Valor Acrescentado (CIVA):** Lei n.º 7/19 e Lei n.º 42/20 (incluindo Regimes Geral, Simplificado e de Exclusão);
   - **Código Comercial de Angola:** no que concerne à obrigatoriedade de escrituração mercantil e arquivo de documentação comercial.
2. **Imutabilidade e Assinatura Criptográfica:** Todos os documentos fiscais emitidos na plataforma são assinados digitalmente através do algoritmo criptográfico **RSA-2048 PKCS#1 v1.5** conjugado com encadeamento de hash **SHA-256**, extração dos quatro carateres de controlo e aposição de **QR Code Fiscal de Alta Densidade (Nível H)**, sendo tecnicamente impossível a sua alteração, substituição retroativa ou omissão cronológica de sequências.
3. **Anulações e Retificações:** Em estrito cumprimento do Decreto 71/25 e das regras da AGT, não é permitida a eliminação física de documentos emitidos. Qualquer correção deve ser efetuada exclusivamente através da emissão de documento retificativo (Nota de Crédito `NC` devidamente fundamentada e vinculada à fatura de origem).

---

### CLÁUSULA 3.ª — RESPONSABILIDADES DO CLIENTE / SUBSCRIÇÃO

1. O Cliente é o único e exclusivo responsável pela:
   - Veracidade, exatidão e licitude de todos os dados fiscais e cadastrais inseridos (NIF da empresa, morada, denominação social, enquadramento de regime de IVA e isenções tributárias);
   - Parametrização correta das taxas de IVA aplicáveis aos artigos e serviços comercializados (incluindo seleção dos códigos legais de isenção M00 a M14);
   - Custódia, sigilo e não partilha das credenciais de acesso (e-mails, palavras-passe e chaves privadas) atribuídas aos seus colaboradores e operadores de caixa;
   - Comunicação e submissão atempada dos ficheiros oficiais **SAF-T (AO)** no Portal de Contribuintes da AGT até ao dia limite estipulado por lei (habitualmente até ao dia 15 do mês seguinte ao período reportado).
2. É expressamente vedado ao Cliente:
   - Utilizar o Sistema para práticas de fraude fiscal, simulação de operações comerciais, evasão tributária ou branqueamento de capitais;
   - Tentar realizar engenharia reversa, descompilação, exploração de vulnerabilidades ou injeção de código malicioso na rede do Kudiba ERP;
   - Partilhar acessos com entidades terceiras não autorizadas ou sublicenciar a plataforma sem consentimento prévio por escrito.

---

### CLÁUSULA 4.ª — NÍVEL DE SERVIÇO (SLA) E CONTINGÊNCIA TRIBUTÁRIA

1. **Disponibilidade da Infraestrutura:** A YHADI SOLUÇÕES envidará todos os esforços técnicos comercialmente razoáveis para manter o Kudiba ERP disponível com um índice de disponibilidade (*Uptime*) de **99,5%**, com exceção de manutenções programadas comunicadas com antecedência mínima de 24 horas.
2. **Modo de Contingência Legal (Dec. Presidencial 71/25):** 
   - Na eventualidade de falha de conectividade com a Internet ou indisponibilidade temporária dos webservices tributários da AGT, o Kudiba ERP ativa automaticamente o mecanismo legal de **Contingência Fiscal**.
   - Os documentos emitidos em contingência contêm a menção legal explícita e são armazenados de forma imutável na base de dados local, sendo despachados e sincronizados com a AGT de forma assíncrona assim que a ligação for restabelecida.
3. **Backups e Segurança de Dados:** A infraestrutura do Kudiba realiza cópias de segurança diárias encriptadas (*Backups*) com retenção geodistribuída, garantindo a recuperação rápida em situações de catástrofe ou falha de hardware.

---

### CLÁUSULA 5.ª — LICENCIAMENTO, PLANOS E FATURAÇÃO

1. A subscrição do Kudiba ERP concede ao Cliente uma licença de uso temporária, não exclusiva, intransmissível e revogável, mediante o pagamento pontual da anuidade ou mensalidade correspondente aos módulos contratados.
2. A falta de regularização dos pagamentos após notificação formal com prazo de cortesia de 15 (quinze) dias poderá resultar na suspensão temporária do acesso à emissão de novos documentos, mantendo-se garantido o acesso de consulta e exportação de relatórios fiscais anteriores nos termos da lei.

---

### CLÁUSULA 6.ª — ARQUIVO LEGAL E EXPORTAÇÃO DE DADOS

1. Em cumprimento do Artigo 44.º do Código Comercial de Angola e do Regime das Faturas, os documentos emitidos na plataforma permanecem sob custódia e arquivo eletrónico pelo período legal mínimo de **10 (dez) anos civis**.
2. O Cliente tem o direito inalienável de extrair e exportar a totalidade dos seus registos fiscais a qualquer momento, mediante o descarregamento do ficheiro canónico **SAF-T (AO) v1.01_01**, mapas em PDF e tabelas analíticas em Excel.

---

### CLÁUSULA 7.ª — PROPRIEDADE INTELECTUAL

1. Todos os direitos de propriedade intelectual, patentes, marcas registadas, código-fonte, arquitetura de microserviços, algoritmos de cálculo fiscal, modelos de relatórios e documentação técnica associados ao Kudiba ERP são pertença exclusiva da **YHADI SOLUÇÕES - PRESTAÇÃO DE SERVIÇOS, (SU), LDA**.
2. A concessão de licença ao Cliente não transfere qualquer direito de propriedade sobre a plataforma ou o seu código-fonte subjacente.

---

### CLÁUSULA 8.ª — RESOLUÇÃO DE LITÍGIOS E FORO COMPETENTE

1. Para a resolução de qualquer litígio emergente da interpretação, validade, execução ou cessação dos presentes Termos e Condições, as partes procurarão obter uma solução amigável num espírito de boa-fé.
2. Na impossibilidade de resolução amigável no prazo de 30 (trinta) dias, é declarado competente o **Foro da Comarca de Luanda**, República de Angola, com expressa renúncia a qualquer outro foro.
