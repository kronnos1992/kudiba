# AGT — Registar Factura Electrónica

Este é o primeiro contrato da integração AGT documentado endpoint a endpoint. O contrato abaixo corresponde à versão 1 publicada no [Portal do Parceiro da AGT](https://portaldoparceiro.minfin.gov.ao/doc-agt/faturacao-electronica/1/servicos/registar.html).

## Serviço

| Ambiente | Método e URL |
|---|---|
| Homologação | `POST https://sifphml.minfin.gov.ao/sigt/fe/v1/registarFactura` |
| Produção | `POST https://sifp.minfin.gov.ao/sigt/fe/v1/registarFactura` |

Headers:

```http
Authorization: Basic <base64(username:password)>
Content-Type: application/json
Accept: application/json
```

As credenciais Basic Auth são emitidas pela AGT para o produtor de software; são independentes do token de sessão do Kudiba. A página de autenticação também descreve JWS RS256 para o software, para cada documento e para chamadas de serviço, quando aplicável.

## Pedido

O exemplo abaixo segue a estrutura do exemplo publicado para `documents`. Os valores são ilustrativos; os identificadores, NIF, dados do software e assinaturas têm de ser substituídos por dados reais certificados.

```json
{
  "schemaVersion": "2.0",
  "submissionUUID": "550e8400-e29b-41d4-a716-446655440000",
  "taxRegistrationNumber": "<NIF_EMISSOR>",
  "submissionTimeStamp": "2025-11-04T14:30:00Z",
  "softwareInfo": {
    "softwareInfoDetail": {
      "productId": "<NOME_SOFTWARE>",
      "productVersion": "<VERSAO>",
      "softwareValidationNumber": "<NUMERO_CERTIFICACAO>",
      "signatureVersion": 1
    },
    "jwsSoftwareSignature": "<JWS_RS256_DO_SOFTWARE>"
  },
  "numberOfEntries": 1,
  "documents": [
    {
      "documentNo": "<NUMERO_DOCUMENTO_DA_SERIE_AGT>",
      "documentStatus": "N",
      "jwsDocumentSignature": "<JWS_RS256_DO_DOCUMENTO>",
      "documentDate": "2025-11-04",
      "documentType": "FT",
      "systemEntryDate": "2025-11-04T14:30:00Z",
      "customerTaxID": "<NIF_OU_IDENTIFICADOR_DO_CLIENTE>",
      "customerCountry": "AO",
      "companyName": "<NOME_DO_CLIENTE>",
      "lines": [
        {
          "lineNumber": 1,
          "productCode": "PROD001",
          "productDescription": "Produto de exemplo",
          "quantity": 2,
          "unitOfMeasure": "UN",
          "unitPriceBase": 250,
          "unitPrice": 250,
          "debitAmount": 0,
          "creditAmount": 500,
          "taxes": [
            {
              "taxType": "IVA",
              "taxCountryRegion": "AO",
              "taxCode": "NOR",
              "taxPercentage": 14,
              "taxContribution": 70
            }
          ],
          "settlementAmount": 0
        }
      ],
      "documentTotals": {
        "taxPayable": 70,
        "netTotal": 500,
        "grossTotal": 570
      },
      "withholdingTaxList": [
        {
          "withholdingTaxType": "IRT",
          "withholdingTaxDescription": "Retenção na fonte",
          "withholdingTaxAmount": 16.5
        }
      ]
    }
  ]
}
```

### Campos e regras a observar

- `submissionUUID`: UUID v4 único por submissão. Gerar um novo para cada pedido.
- `numberOfEntries`: tem de ser igual ao número de elementos de `documents`; a documentação prevê até 30 documentos por pedido.
- `softwareInfo.softwareInfoDetail`: `productId`, `productVersion`, `softwareValidationNumber` e `signatureVersion` são indicados como obrigatórios na tabela do serviço.
- `jwsSoftwareSignature`: assina a informação do software, incluindo o objecto `softwareInfoDetail`, com RS256.
- `documentNo`: número da série autorizada pela AGT, não o identificador interno UUID da factura.
- `documentStatus`: `N` no exemplo publicado.
- `jwsDocumentSignature`: JWS do documento. A página de estrutura indica assinatura do objecto com `documentNo`, `taxRegistrationNumber`, `documentType`, `documentDate`, `customerTaxID`, `customerCountry`, `companyName` e `documentTotals`.
- `lines`, `paymentReceipt` e `withholdingTaxList` são condicionais conforme o tipo de documento e as regras fiscais. A lista de linhas deve ser sequencial e os totais têm de corresponder aos valores das linhas.
- A documentação usa valores numéricos para quantidades e montantes. Não serializar esses campos como strings.
- O documento limita `customerCountry` a dois caracteres. O `taxRegistrationNumber` do emissor pode ter até 15 caracteres.

### Assinaturas

O Portal especifica RS256 e JWS Compact Serialization: `base64url(header).base64url(payload).base64url(signature)`, sem padding Base64 normal. Não é equivalente à assinatura RSA Base64 actualmente guardada pelo motor fiscal. O objecto de assinatura do documento tem de incluir apenas os campos definidos para esta operação; a assinatura do software é separada da assinatura do documento.

A página específica de `registarFactura` não lista um `jwsSignature` ao nível superior do pedido; não o adicionar por analogia com outros serviços sem confirmação da AGT.

## Resposta

Pedido aceite para processamento assíncrono:

```json
{
  "requestID": "<ID_ATRIBUIDO_PELA_AGT>",
  "errorList": []
}
```

`requestID` confirma a recepção, não a validação fiscal final. Guardá-lo com a submissão e usá-lo posteriormente no endpoint de consulta de estado, que será documentado separadamente. A resposta pode também incluir `errorList`, com `idError`, `descriptionError` e, quando aplicável, `documentNo`. A página indica que um pedido duplicado pode devolver o `requestID` original.

## Divergências na especificação publicada

Antes de activar chamadas reais, confirmar estes pontos com a AGT ou com um pedido de homologação:

1. O exemplo de pedido apresenta os campos do documento directamente em cada elemento de `documents`; a tabela formal descreve um campo obrigatório `document` dentro desse elemento. O JSON acima segue o exemplo, mas a forma canónica continua por confirmar.
2. O exemplo de linha não inclui `operationType`, embora a tabela formal o marque obrigatório. O exemplo do documento também não inclui `eacCode`, embora a tabela o descreva. Confirmar quais os campos requeridos para cada tipo de documento.
3. O exemplo de imposto usa `taxContribution`, enquanto a tabela formal lista `taxAmount`. Confirmar o nome aceite e a regra de cálculo com a AGT antes de assinar ou transmitir.
4. O exemplo não inclui `paymentReceipt`, que é condicional, nem ilustra `referenceInfo`/`sourceDocuments`. Confirmar os formatos necessários para recibos, notas de crédito e outros documentos rectificativos.
5. A página de estrutura descreve JWS Compact Serialization, enquanto algumas tabelas chamam ao valor apenas “Base64URL” e impõem comprimentos fixos. Implementar JWS Compact segundo o algoritmo e validar em homologação; não truncar nem codificar novamente o token.

## Estado no Kudiba

Este contrato documenta o pedido AGT, não a emissão local. O `POST /api/v1/invoices` do Kudiba emite e guarda o documento localmente; o actual `POST /api/v1/fiscal/agt/sync` ainda não implementa `registarFactura` e a submissão está bloqueada. A camada de tradução e assinatura JWS deve ser implementada e testada isoladamente antes de enviar documentos.
