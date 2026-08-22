# V1 Deployment Contract

## Current finding
The repository contains backend modules and tests, but no deployment manifest was found for a Node hosting target. Therefore the backend is not yet deployable from the repository alone.

## Required production shape
- Node.js 20 runtime
- HTTPS public endpoint
- Meta webhook GET + POST routes
- Server-side environment variables only
- One configured V1 WhatsApp Phone Number ID
- Supabase REST access from server
- OpenAI access from server

## Required routes
- `GET /webhook` — Meta verification
- `POST /webhook` — Meta inbound events
- `GET /health` — non-secret readiness/health response

## Health endpoint rules
Never return secret values. Report only safe states such as `ok`, `not_ready`, or dependency status without credentials.

## Release gate
Do not claim V1 operational until the deployed HTTPS endpoint passes the real Meta verification and inbound message test.

## Cost constraint
Prefer a free-tier deployment target where technically viable. No paid service is to be enabled automatically.
