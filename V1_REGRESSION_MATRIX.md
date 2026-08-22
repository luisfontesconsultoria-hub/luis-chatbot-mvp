# V1 Regression Matrix

## Prior approvals that must remain true

| ID | Cenário | Resultado obrigatório |
|---|---|---|
| R01 | Nome informado | guardar nome e seguir para interesse |
| R02 | Conta + máquina juntos | reconhecer ambos e seguir para faturamento |
| R03 | Banco + máquina | reconhecer entidades e seguir para faturamento |
| R04 | Faturamento 49 mil | reconhecer valor e seguir para dor |
| R05 | Dor = taxa | seguir para aceite |
| R06 | Aceite positivo | perguntar online/presencial |
| R07 | Online/presencial | seguir para dia/data/horário |
| R08 | CNPJ inválido | pedir correção; não consultar |
| R09 | CNPJ válido recebido | entrar em AGUARDANDO_RETORNO_DO_LUIS |
| R10 | Mensagem enquanto bloqueado | não avançar automaticamente |
| R11 | Retorno autorizado | liberar somente a etapa correspondente |
| R12 | Crédito/financiamento etc. | informar que depende de análise; não prometer aprovação |
| R13 | Evento duplicado | não duplicar lead/mensagem/avanço |
| R14 | Ferramenta indisponível | retry/handoff; não inventar resultado |
| R15 | Segredo/API key | nunca aparecer no front-end |
| R16 | WhatsApp | somente o número atual na V1 |

## Performance/UX
- Resposta assíncrona e idempotente.
- Não bloquear o webhook aguardando operações longas quando a arquitetura permitir fila.
- Timeout e retry com limite.
- Mensagens curtas, naturais e orientadas à próxima ação.

## Segurança
- Validar payload recebido.
- Sanitizar conteúdo antes de renderizar.
- Nunca executar conteúdo recebido do cliente como código.
- Logs sem tokens, senhas ou dados desnecessários.
