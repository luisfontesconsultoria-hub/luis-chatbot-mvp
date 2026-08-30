# Capture Station

The capture station is intentionally independent from CRM persistence.

## Current provider

- `google_maps` — active acquisition adapter.

## Future providers

Providers are registered through `capture-providers.js`. A provider only needs a `search(params)` function and should return records compatible with the capture contract.

Examples for later integration:

- Casa dos Dados — API key stored in environment/secret manager.
- Authorized business-data APIs.
- AI enrichment provider.
- CSV/manual import adapter.

## Pipeline

`provider -> capture contract -> normalize -> dedupe -> CNPJ -> eligibility -> score -> filters -> READY_FOR_CRM`

`READY_FOR_CRM` is an output state, not a CRM write. This station does not import Supabase, WhatsApp, SDR or CRM persistence modules.

## Configuration

Use environment variables; never commit API keys.

- `CAPTURE_PROVIDER` (default: `google_maps`)
- `CAPTURE_BATCH_SIZE` (default: `100`)
- `CAPTURE_EXCLUDE_MEI` (default: `true`)
- `CAPTURE_MIN_SCORE` (default: `50`)

## Integration rule

A future CRM integration should consume the exported `READY_FOR_CRM` payload through an explicit adapter. Do not add direct CRM writes to the capture modules.
