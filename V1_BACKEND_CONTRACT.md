# V1 Backend Contract

## Entrada do canal
O adapter do WhatsApp deve normalizar cada mensagem para:

```json
{
  "channel": "WHATSAPP",
  "external_message_id": "provider-message-id",
  "phone": "5511999999999",
  "timestamp": "ISO-8601",
  "type": "text|audio|image|other",
  "text": "mensagem normalizada",
  "media_url": null,
  "source": "WHATSAPP",
  "campaign": null
}
```

## Pipeline
1. Validar payload.
2. Gerar/verificar idempotency key.
3. Encontrar ou criar lead por telefone.
4. Persistir mensagem recebida.
5. Carregar estado atual.
6. Executar regra determinística de bloqueio/roteamento.
7. Quando necessário, chamar IA com contexto mínimo e regras relevantes.
8. Quando necessário, chamar ferramenta autorizada.
9. Atualizar lead + estado + auditoria.
10. Gerar resposta.
11. Enviar resposta pelo adapter.
12. Persistir resposta enviada.

## Regra de bloqueio
Se status == AGUARDANDO_RETORNO_DO_LUIS, nenhuma mensagem comum do cliente pode liberar o estado.
Somente evento interno autorizado pode alterar o estado.

## Falhas
- validação: rejeitar e registrar;
- duplicado: retornar resultado idempotente, sem duplicar efeitos;
- IA indisponível: fallback determinístico curto ou handoff;
- ferramenta indisponível: ERROR_RETRY/HUMAN_HANDOFF;
- envio WhatsApp falho: retry com limite e registro do erro.

## Segurança
- segredos somente no servidor;
- não registrar Authorization headers/tokens;
- validar origem/webhook conforme provedor escolhido;
- limitar tamanho de payload;
- sanitizar conteúdo antes de exibição;
- nunca executar conteúdo do usuário;
- aplicar rate limit compatível com o baixo volume da V1.

## Resposta interna
```json
{
  "lead_id": "uuid",
  "status": "QUALIFYING",
  "reply": "texto",
  "actions": [],
  "handoff": false,
  "tool_calls": []
}
```

O contrato desacopla WhatsApp, IA e banco. Assim o segundo/terceiro/quarto WhatsApp futuramente será outro adapter, sem reescrever o SDR.
