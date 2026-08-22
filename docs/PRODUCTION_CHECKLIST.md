# V1 Production Checklist

## Code
- [x] HTTP server and `/health`
- [x] Meta webhook verification
- [x] Meta HMAC signature validation
- [x] Idempotency guard
- [x] SDR gateway
- [x] Inbound/outbound message persistence contracts
- [x] CRM/Supabase mapper contract
- [x] E2E contract test
- [x] GitHub Actions workflow

## Render
- [x] Node runtime
- [x] Production start command
- [x] Health check
- [x] Secrets declared as non-synced environment variables
- [ ] Deploy service
- [ ] Verify `/health` in production

## Supabase
- [x] Schema reviewed
- [x] Unique constraints reviewed
- [x] RLS reviewed
- [ ] Confirm production project URL
- [ ] Confirm production service-role key
- [ ] Execute real persistence smoke test

## Meta / WhatsApp
- [x] Webhook route implemented
- [x] Verify-token flow implemented
- [x] Signature validation implemented
- [x] Outbound sender implemented
- [ ] Production app credentials
- [ ] Production phone-number ID
- [ ] Graph API version selected
- [ ] Configure callback URL
- [ ] Verify webhook
- [ ] Send/receive real test message

## CRM
- [ ] Production frontend URL
- [ ] Authentication enabled
- [ ] Manual lead creation verified
- [ ] WhatsApp conversation view verified
- [ ] Pipeline/status updates verified

## Final gate
- [ ] CI run passes
- [ ] Production E2E passes
- [ ] Security smoke test passes
- [ ] Backup/rollback procedure documented
- [ ] V1 declared production-ready
