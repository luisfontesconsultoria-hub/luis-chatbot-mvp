# Robô de vendas por número e por produto

O CRM não depende de um número específico. Cada WhatsApp conectado tem um modo, escolhido no painel em **Assistente → Robô de vendas**:

| Modo | O que acontece quando um cliente chama |
|---|---|
| **Desligado** (padrão) | O CRM só registra a conversa. O robô não responde e não altera o lead. |
| **Roteiro Conta PJ** | Roteiro original: qualificação, CNPJ, consulta manual, agendamento. |
| **Vender produto** | Roteiro de venda de um produto do catálogo (anúncios / afiliados). |

Um número sem configuração fica **Desligado**. A troca de modo vale na mensagem seguinte, sem reiniciar o servidor.

## Cadastro do produto

| Campo | Para que serve |
|---|---|
| Nome | Como o robô chama o produto. |
| Link de afiliado | Página oficial de venda. Só `https://`. É o único link que o robô envia. |
| Código da campanha | 3 a 20 letras ou números (ex.: `EMAG`). Identifica de qual anúncio o cliente veio. |
| Valor | Opcional. O robô só cita valor se estiver escrito aqui. |
| Origem dos anúncios | Gravada no lead quando ele chega com o código (padrão: Google Ads). |
| Apresentação | Primeira mensagem do robô. |
| O que o robô pode dizer | Base para responder dúvidas quando a IA está ligada. |

## Link do anúncio

O painel gera o link para colocar no anúncio ou na página do produto:

```
https://wa.me/<número conectado>?text=Olá! Quero saber mais sobre <produto> (ref EMAG)
```

Para separar campanhas ou anúncios do mesmo produto, acrescente um complemento depois do código: `ref EMAG-BUSCA1`, `ref EMAG-PMAX2`. O texto inteiro (`EMAG-BUSCA1`) é gravado no campo **campanha** do lead.

Sem código na mensagem, o robô usa o produto escolhido para o número.

## Roteiro de venda

1. **Primeiro contato**: o robô se identifica como assistente virtual, apresenta o produto e oferece o link.
2. **Aceite, pedido de link, pagamento ou preço**: envia o link oficial (e o valor, se cadastrado). O lead passa para *Link enviado*.
3. **Dúvida**:
   - com IA ligada, responde usando só o cadastro do produto;
   - sem IA, envia o link uma vez e, se o link já foi enviado, passa para atendimento humano.
4. **Pedido de atendente**: avisa o cliente e passa para atendimento humano.
5. **Pedido para parar**: confirma uma vez e não envia mais nada.

Regras fixas, fora do controle da IA:

- O robô só conduz lead novo ou que já está no roteiro do produto. Cliente em outro estágio não é abordado.
- Em atendimento humano o robô fica em silêncio até uma pessoa retomar.
- Depois de 12 respostas automáticas para o mesmo lead, passa para atendimento humano.
- Resposta da IA com link diferente do oficial, ou com valor em reais que não está no cadastro, é descartada.
- O robô só responde a quem chamou. Não há disparo em massa.

## O que fica registrado

- No lead: `status` (`PRODUCT_PRESENTED`, `PRODUCT_LINK_SENT`, `HUMAN_HANDOFF`, `LOST`), produto de interesse, campanha e origem.
- Eventos: `PRODUCT_LINK_SENT` (produto, campanha, número) e `SDR_HUMAN_GATE` quando passa para uma pessoa.
- Auditoria: `SDR_DECISION` com modo, produto, campanha e intenção detectada.

## Onde a configuração fica

Arquivo `sdr-settings.json` na pasta de `WHATSAPP_QR_SESSION_DIR` (em produção, o disco persistente). `SDR_SETTINGS_FILE` permite apontar outro caminho. Se a pasta for temporária (`/tmp`), o painel avisa: a configuração se perde no reinício e os números voltam a **Desligado**.

## Ainda não incluído

- Confirmação automática da venda pela plataforma de afiliados.
- Envio da venda de volta ao Google Ads como conversão.
- Página de produto com captura do identificador de clique do Google.
