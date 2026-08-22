# V1 Pilot Checklist

## Secrets / environment
- [ ] Supabase URL configured
- [ ] Supabase service-role key configured server-side only
- [ ] Meta access token configured server-side only
- [ ] Meta verify token configured
- [ ] Meta app secret configured
- [ ] OpenAI API key configured server-side only
- [ ] No secret committed to Git

## Meta / WhatsApp
- [ ] WhatsApp Business asset configured in Meta
- [ ] V1 phone number ID recorded in secure environment
- [ ] Webhook HTTPS endpoint reachable
- [ ] GET verification succeeds
- [ ] POST signature validation succeeds
- [ ] Non-message events ignored safely
- [ ] Single-number pilot gate enabled

## Data / CRM
- [ ] Supabase schema/migrations applied
- [ ] Lead creation verified
- [ ] Message persistence verified
- [ ] Audit persistence verified
- [ ] Idempotency verified with duplicate delivery
- [ ] Retention/minimization policy reviewed

## AI / SDR
- [ ] AI provider reachable
- [ ] AI cannot override commercial state
- [ ] Human handoff tested
- [ ] AGUARDANDO_RETORNO_DO_LUIS lock tested
- [ ] Text response tested
- [ ] Audio transcription tested

## Go-live safety
- [ ] Low-volume pilot only
- [ ] No bulk outbound campaign enabled
- [ ] Manual monitoring during first tests
- [ ] Rollback/disable procedure tested
- [ ] Other three WhatsApp numbers remain disabled

**Gate:** V1 is public-pilot ready only when every required checkbox above is validated in the real environment.
