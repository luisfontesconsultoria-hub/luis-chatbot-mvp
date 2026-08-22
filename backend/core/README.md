# V1 Core invariants

- `externalMessageId` is mandatory.
- Duplicate inbound events must stop before AI, tools and outbound messaging.
- `AGUARDANDO_RETORNO_DO_LUIS` and `HUMAN_HANDOFF` cannot be released by customer text.
- CNPJ must pass local validation before authorized lookup.
- Provider adapters cannot contain business rules.
- Secrets never enter browser code, logs or prompts.
- Only the current WhatsApp is enabled in V1.
