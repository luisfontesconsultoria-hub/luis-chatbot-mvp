# luis-chatbot-mvp
MVP do chatbot comercial do Luís Paulo Fontes.

## V1
Backend comercial com webhook Meta/WhatsApp, SDR, persistência Supabase e contratos de CRM.

## Desenvolvimento
Requer Node.js 20+.

```bash
npm install
npm test
npm start
```

Health check local: `GET /health`.

## Produção
O `render.yaml` define o serviço web, comando de inicialização, health check e variáveis de ambiente. Nunca coloque tokens, chaves do Supabase, secrets da Meta ou chaves de IA no repositório.

Variáveis principais:
- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `META_VERIFY_TOKEN` / `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN` / `WHATSAPP_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID` / `WHATSAPP_PHONE_NUMBER_ID`
- `META_GRAPH_API_VERSION`
- `AI_PROVIDER=gemini` ou `ollama`
- `GEMINI_API_KEY` e opcionalmente `GEMINI_MODEL` quando usar Gemini
- `OLLAMA_BASE_URL` e `OLLAMA_MODEL` quando usar Ollama local
- `AI_ASSIST_ENABLED=true|false`
- `CRM_KNOWLEDGE_BASE` opcional: contexto comercial controlado enviado ao assistente

O CRM possui até 4 slots independentes de WhatsApp, cada um destinado a um número/canal separado. A plataforma não implementa disparos em massa; os canais são para atendimento de mensagens recebidas e respostas comerciais individuais.

O SDR mantém uma camada determinística de segurança/estado e usa a IA como camada assistiva. Histórico recente da conversa e a base de conhecimento configurada podem ser enviados ao modelo sem expor credenciais.

Antes de produção, executar a checklist em `docs/PRODUCTION_CHECKLIST.md` e validar o webhook e o fluxo WhatsApp ponta a ponta.
