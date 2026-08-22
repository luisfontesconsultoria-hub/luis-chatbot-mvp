# V1 Production Checklist

## Secrets
- [ ] Generate a new OpenAI API key; never reuse the previously exposed key.
- [ ] Store secrets only in the deployment secret manager/environment.
- [ ] Verify no secret appears in Git history, logs, browser bundles, or screenshots.

## Supabase
- [ ] Create/verify `crm_leads`, `crm_activities`, `crm_messages`, `crm_audit`.
- [ ] Apply RLS and tenant isolation before production data.
- [ ] Verify service-role key is server-only.
- [ ] Test create/read/update/list paths.

## Deployment
- [ ] HTTPS endpoint active.
- [ ] Health endpoint returns OK.
- [ ] Production environment gate passes.
- [ ] Logging redacts secrets and sensitive tokens.

## Meta / WhatsApp
- [ ] Configure Meta webhook callback URL.
- [ ] Configure verify token.
- [ ] Configure phone number ID/access token.
- [ ] Verify webhook signature/security controls.
- [ ] Send controlled test message from a real customer number.

## E2E
- [ ] New lead created.
- [ ] Source attribution preserved.
- [ ] Score/routing applied.
- [ ] CRM record persisted.
- [ ] Conversation persisted.
- [ ] SDR response delivered.
- [ ] Duplicate/retry behavior verified.
- [ ] Human escalation path verified.

## Release
- [ ] No blocking security findings.
- [ ] Core CI green.
- [ ] Rollback procedure tested.
- [ ] Owner CRM verified in browser.
