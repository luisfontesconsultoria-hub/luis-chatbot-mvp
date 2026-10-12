# Operação de afiliados — SDR, rastreio e webhook de venda

Este módulo faz o CRM atender leads de anúncios (Google Ads / Meta Ads) de produtos de afiliado.
O fluxo PJ continua igual: nada muda enquanto `SDR_MODE` não for configurado.

## 1. Ligar o modo afiliado

| Variável (Render → Environment) | Exemplo | Efeito |
| --- | --- | --- |
| `WHATSAPP_MAX_SLOTS` | `2` | Habilita o slot 2 para o número de afiliado (padrão 1) |
| `SDR_MODE_SLOT_<n>` | `SDR_MODE_SLOT_2=AFILIADO` | Só o WhatsApp do slot `n` atende como afiliado (recomendado) |
| `SDR_MODE` | `AFILIADO` | Modo padrão de todos os slots e do webhook Meta (padrão `PJ`) |
| `AFFILIATE_PRODUCTS` | JSON abaixo | Fichas dos produtos. Sem ficha válida, todo lead vai para o Luís |
| `AFFILIATE_WEBHOOK_SECRET` | texto longo aleatório | Protege o webhook de venda. Sem ele, o webhook responde 503 |

Ordem de prioridade do modo: `SDR_MODE_SLOT_<n>` > `SDR_MODE` > `PJ`.

## 2. Ficha do produto (`AFFILIATE_PRODUCTS`)

O robô só afirma o que está na ficha. Campo vazio = o robô não fala do assunto e passa a dúvida para o Luís.

```json
[
  {
    "code": "PROD1",
    "name": "Nome do produto",
    "checkout_url": "https://link-de-afiliado-da-plataforma",
    "tracking_param": "sck",
    "topic": "organizar as finanças",
    "for_who": "quem quer sair do vermelho",
    "not_for": "quem procura enriquecer rápido",
    "includes": "O que vem dentro, em 1 a 3 frases.",
    "price": "12x de R$ 29,70 ou R$ 297 à vista",
    "guarantee": "7 dias de garantia",
    "bonuses": "Planilha de controle",
    "aliases": ["nome curto"],
    "objections": [
      { "keywords": ["nao tenho tempo", "sem tempo"], "answer": "Resposta aprovada pelo Luís." }
    ]
  }
]
```

- `code`: letras, números e `_`. É o mesmo código usado na campanha.
- `checkout_url`: precisa ser `https`.
- `tracking_param`: parâmetro de rastreio da plataforma escolhida (padrão `sck`). **Confirmar na plataforma.**
- `keywords` das objeções: sem acento, em minúsculas.

## 3. Código de campanha (página ponte → WhatsApp)

O botão de WhatsApp da página ponte deve pré-preencher a mensagem com um código:

```
Olá! Quero saber mais #G-PROD1-K03
```

`G` = Google Ads, `M` = Meta Ads, `I` = Instagram, `O` = orgânico · `PROD1` = código da ficha · `K03` = anúncio/palavra (opcional).
O CRM grava `campaign`, `source` e `product_interest` no lead.

## 4. Roteiro do SDR

Identificar produto → diagnóstico (dor) → encaixe → apresentação → dúvidas/objeções → link de compra → pós-venda.

- Preço, garantia, conteúdo, bônus, objeções e link saem **direto da ficha**. A IA nunca reescreve essas respostas.
- Dúvida sem resposta na ficha ou pedido para falar com humano → status `AGUARDANDO_RETORNO_DO_LUIS` com próxima ação `RESPONDER_DUVIDA_AFILIADO`. O robô fica em silêncio.
  O lead aparece na fila humana como `RESPONDER_DUVIDA_E_LIBERAR`. Depois de responder no WhatsApp, use **Liberar** (`POST /api/crm/leads/:id/human-release`): o lead volta para `AF_DECIDING`.
- "Não tenho interesse", "pare de mandar", "sair" → lead encerrado (`LOST` / etapa `PERDIDO`) e o robô para de responder. Só volta se a própria pessoa pedir para comprar.

Etapas comerciais usadas: `QUALIFYING` (diagnóstico) → `QUALIFIED` → `NEGOTIATION` (link enviado) → `CONVERTIDO` (venda aprovada) / `REEMBOLSADO` / `PERDIDO`.

## 5. Webhook de venda

URL para cadastrar na plataforma:

```
https://luis-chatbot-mvp.onrender.com/webhooks/affiliate-sale?token=<AFFILIATE_WEBHOOK_SECRET>&platform=<nome>
```

(ou enviar o segredo no header `x-affiliate-secret`). Aceita JSON ou formulário.

- O link enviado pelo SDR leva o token do lead (`L` + 32 caracteres) no `tracking_param`. O webhook procura esse token no payload e encontra o lead.
- Aprovada → etapa `CONVERTIDO`, status `AF_SOLD`. Reembolso/chargeback/cancelamento → etapa `REEMBOLSADO`.
- Mesma transação nunca é aplicada duas vezes.
- Venda sem token reconhecido → evento `AFFILIATE_SALE_UNMATCHED` para conferência manual.
- Nome e e-mail do comprador **não** são gravados.

O parser é genérico. Quando a plataforma for escolhida, validar com uma venda de teste e, se o formato exigir, adicionar o parser específico.

## 6. Pendências conhecidas

- Follow-up automático (24 h / 72 h / 7 dias) ainda não existe: o lead fica com próxima ação `FAZER_FOLLOW_UP`/`ACOMPANHAR_COMPRA` para ação manual.
- Envio da conversão de volta para Google Ads (offline) e Meta (API de Conversões) não implementado.
- Render free derruba o processo e a sessão do WhatsApp: resolver antes de ligar anúncios pagos.
