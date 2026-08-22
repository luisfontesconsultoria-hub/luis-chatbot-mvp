# V1 Backend Contract

Este diretório define o contrato do orquestrador. A implementação pode ser feita em qualquer runtime gratuito compatível com o ambiente escolhido, sem alterar o contrato.

## Pipeline

1. Receber webhook do WhatsApp.
2. Validar autenticação/assinatura do provedor.
3. Normalizar evento.
4. Exigir `external_message_id` e aplicar idempotência.
5. Localizar ou criar lead por telefone.
6. Persistir mensagem recebida.
7. Carregar estado atual e contexto necessário.
8. Se `AGUARDANDO_RETORNO_DO_LUIS`, não avançar automaticamente.
9. Executar regras determinísticas antes da IA para fatos críticos.
10. Chamar IA somente para interpretação/resposta quando necessário.
11. Chamar ferramenta externa autorizada para CNPJ quando a etapa permitir.
12. Persistir alterações de lead/estado e auditoria.
13. Enviar resposta pelo adapter WhatsApp.
14. Persistir mensagem enviada e evento de resultado.

## Erros

- payload inválido: rejeitar e registrar evento técnico;
- evento duplicado: retornar sucesso idempotente sem repetir processamento;
- timeout: retry limitado;
- ferramenta indisponível: `ERROR_RETRY` ou `HUMAN_HANDOFF`;
- falha de IA: resposta segura/fallback ou humano;
- nenhuma falha técnica pode liberar `AGUARDANDO_RETORNO_DO_LUIS`.

## Contrato de entrada normalizado

```json
{
  "channel": "WHATSAPP",
  "external_message_id": "provider-message-id",
  "phone": "+55...",
  "text": "mensagem do cliente",
  "timestamp": "2026-08-22T12:00:00Z",
  "metadata": {}
}
```

## Contrato de saída interna

```json
{
  "lead_id": "uuid",
  "reply_text": "resposta para o cliente",
  "next_status": "QUALIFYING",
  "handoff": false,
  "tool_calls": [],
  "audit": {}
}
```

## Segurança

Nunca colocar tokens de provedor, chave de IA ou service-role key em HTML/JavaScript público. O cliente só fala com o endpoint do backend. A service role do Supabase permanece exclusivamente no ambiente servidor.

## Escopo V1

O único adapter de canal ativo é o WhatsApp atual. Instagram, voz, Google Ads, Meta Ads e novos números são integrações futuras/externas ao núcleo e não devem alterar o contrato do SDR.
