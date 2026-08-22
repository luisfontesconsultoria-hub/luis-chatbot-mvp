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

Variáveis esperadas:
- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- `META_ACCESS_TOKEN`
- `META_PHONE_NUMBER_ID`
- `META_GRAPH_API_VERSION`

Antes de produção, executar a checklist em `docs/PRODUCTION_CHECKLIST.md` e validar o webhook e o fluxo WhatsApp ponta a ponta.
