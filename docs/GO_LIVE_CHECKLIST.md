# V1 Go-Live Checklist

## Automated gates already covered
- [x] SDR regression and state transitions
- [x] Meta webhook normalization/security
- [x] Supabase persistence contracts
- [x] Idempotency and bounded retry
- [x] Privacy/data minimization contract
- [x] AI secret guard and bounded output
- [x] Commercial license/tenant/entitlement contracts
- [x] HTTP health/configuration gates

## Operator-only gates
These require real credentials or an external dashboard and therefore cannot be completed by code alone.

1. Apply all Supabase migrations in order: `001_v1_schema.sql`, `002_ensure_v1_runtime.sql`, `003_v1_rls_service_role.sql`, `004_v1_retention_indexes.sql`.
2. Configure production environment variables in Render. Never commit secrets.
3. Confirm `GET /health` returns `ok`.
4. Confirm `GET /health/db` returns `database: ok`.
5. Configure Meta webhook verification URL and verify token.
6. Confirm Meta signature validation with a real webhook delivery.
7. Send one real inbound WhatsApp text and verify persistence in `messages` and `events`.
8. Verify SDR response is sent once only and duplicate webhook delivery is ignored.
9. Verify CNPJ validation path and human block state `AGUARDANDO_RETORNO_DO_LUIS`.
10. Verify authorized human release before resuming a blocked lead.
11. Verify AI fallback by temporarily disabling AI assist; commercial state must still work.
12. Run one end-to-end pilot conversation before enabling paid/customer traffic.

## Commercialization gates
- [ ] Tenant provisioning documented
- [ ] License issuance/rotation documented
- [ ] Per-tenant data isolation tested in production-like environment
- [ ] Privacy/legal terms reviewed
- [ ] Support/incident procedure documented
- [ ] Backup/restore procedure tested
- [ ] Usage/cost monitoring enabled
