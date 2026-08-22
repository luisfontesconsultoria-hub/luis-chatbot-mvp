# Secrets & Go-Live

## Required secrets

Set these only in the server/deployment secret store:

- OPENAI_API_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- WHATSAPP_VERIFY_TOKEN
- WHATSAPP_ACCESS_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- META_APP_SECRET

## Rules
- Never commit secret values to Git.
- Never put service-role, OpenAI, Meta access tokens, or app secrets in the landing page.
- Rotate any credential previously exposed in chat, logs, screenshots, or source control.
- V1 allows exactly one configured WhatsApp phone number.
- Future numbers remain disabled until V1 passes the real pilot release gate.

## Preflight
The application must fail closed when a required secret is missing.

## Release sequence
1. Create/rotate secrets.
2. Store them in the deployment secret manager.
3. Run preflight.
4. Configure Meta webhook.
5. Verify the V1 phone number ID.
6. Run the real pilot matrix.
7. Approve controlled pilot only after critical tests pass.
