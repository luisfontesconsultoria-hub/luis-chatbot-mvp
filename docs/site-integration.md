# Landing Page → V1 SDR Integration

## Objective
Treat the existing LF Consultoria landing page as an acquisition channel for the same V1 SDR/CRM pipeline.

## Current site channel
The site already uses the V1 WhatsApp number `+55 51 98966-7702` in its CTAs and records Google Ads conversion events on WhatsApp clicks.

## Target flow
Landing page → WhatsApp CTA → Meta WhatsApp webhook → V1 pipeline → Supabase/CRM → SDR/IA response.

## Attribution
Preserve `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `gclid` when available. The landing page must not expose server secrets.

## Rules
- V1 uses only the current WhatsApp number.
- No other WhatsApp number is enabled before V1 is validated.
- The site must not call Supabase with a service-role key.
- The site must not contain OpenAI or Meta secrets.
- Google Ads conversion remains a click/lead signal; CRM is the source of truth for qualified leads.

## Go-live dependency
The public webhook/API URL must be available before the landing page can send browser-originated lead data directly to the backend. Until then, the existing WhatsApp CTA remains the safe acquisition path.
