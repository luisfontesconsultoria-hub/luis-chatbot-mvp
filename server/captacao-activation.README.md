# Captação V1 — ativação

Fluxo: `captured_companies` → filtro manual → ativação explícita → `leads`.

Endpoints:
- `GET /api/captacao/companies`
- `POST /api/captacao/companies/activate` com `{ "companyId": "..." }`

A ativação é manual, idempotente e registra evento/auditoria. Google Maps, Casa de Dados e N8N permanecem fora deste módulo.
