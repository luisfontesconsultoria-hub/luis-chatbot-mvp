# Unified Commercial Platform — Functional Specification

Status: PLANNING ONLY
Branch: `planning/unified-commercial-platform`

This document consolidates the current V1 SDR/Chat-IA architecture with the functionality identified from the three externally analyzed tools. It is a planning artifact only. It must not be interpreted as authorization to modify the V1 implementation, database schema, production integrations, or WhatsApp setup.

## 1. Current V1 that must remain stable

- Chat/IA
- commercial SDR
- Supabase as persistent source of truth
- one current WhatsApp only
- Meta Ads / Google Ads prepared as acquisition and attribution layers
- authorized CNPJ consultation
- context preservation
- structured CRM persistence
- `AGUARDANDO_RETORNO_DO_LUIS`
- human handoff
- security and no fabricated factual results

## 2. Unified functional target

The future platform is conceptually composed of:

1. Lead acquisition and prospecting
2. CNPJ validation and enrichment
3. Lead deduplication
4. Lead scoring
5. Central CRM
6. WhatsApp + SDR IA
7. Pipeline and follow-up
8. AI commercial assistant
9. Calendar and intelligent scheduling
10. Geolocation and route optimization
11. Visits management
12. Conversion/result tracking
13. Dashboard and analytics
14. Reports/export

## 3. Lead acquisition

Support two logical origins:

### Inbound
- Meta Ads
- Google Ads
- landing page
- future approved channels

### Outbound
- prospecting from authorized sources
- future lead imports

Both paths must converge into the same lead/CRM model.

## 4. Company identity and data quality

A company should have one canonical commercial record.

Candidate attributes:
- CNPJ
- legal name
- trade name
- status
- company size
- primary and secondary CNAE
- segment
- address
- city/state
- phone/WhatsApp when lawfully available
- website
- origin/campaign
- score
- pipeline status
- tags
- owner
- history
- next action
- appointments
- visits

Deduplication should prioritize CNPJ and then contact identifiers such as phone/WhatsApp, with safe association rather than blind record deletion.

## 5. Lead Score

The target model has three conceptual dimensions:

- Profile score: fit with the target company profile
- Interest score: signals obtained from interactions
- Commercial score: combined prioritization score

Score changes must be explainable through criteria/history.

## 6. SDR IA

The SDR remains the core conversational engine and must continue to:

- identify the lead
- preserve context
- qualify
- understand need and interest
- identify decision maker
- capture objections
- update CRM
- update tags/status/score
- schedule next action
- perform appropriate follow-up
- hand off to human when required

AI must not invent CNPJ, credit approval, tariffs, availability, or other factual results requiring an external source/rule.

## 7. Conversation intelligence

A conversation analysis layer may produce structured summaries:

- need
- interest level
- objections
- product interest
- decision maker
- status
- next action
- score update

These summaries are CRM data, not a replacement for raw message history.

## 8. Pipeline

Candidate commercial stages:

`NEW -> FIRST_CONTACT -> QUALIFYING -> QUALIFIED -> INTEREST -> NEGOTIATION -> AWAITING_RETURN -> AGUARDANDO_RETORNO_DO_LUIS -> HUMAN_ATTENDANCE -> CONVERTED`

Auxiliary outcomes:

- OUT_OF_PROFILE
- NO_INTEREST
- NO_RESPONSE
- LOST
- ERROR_RETRY

The exact implementation must preserve the already approved V1 state machine and regression tests before any expansion is merged.

## 9. Follow-up

The assistant should convert explicit future-contact requests into structured next actions with date/time when available. Follow-ups must be auditable and must not bypass the human-lock state.

## 10. AI commercial assistant

Future scope expands the SDR into a personal commercial assistant able to coordinate:

- appointments
- returns
- meetings
- visits
- priorities
- route-aware scheduling

The assistant may suggest or prepare actions; permissions for automatic calendar mutation must be explicitly defined before implementation.

## 11. Intelligent scheduling

When a customer requests a meeting/visit, the future scheduler should consider:

- calendar availability
- meeting duration
- customer location
- nearby existing commitments
- travel time
- route efficiency
- lead priority

The objective is not merely to find an empty slot, but the best feasible slot.

## 12. Geolocation and routes

Route optimization is a retained candidate feature.

A user should eventually be able to select multiple leads/customers and generate an optimized visit sequence considering:

- starting point
- ending point when applicable
- locations
- available time windows
- visit durations
- priority
- estimated travel time/distance

The goal is to reduce travel time, distance, fuel/cost, and wasted schedule capacity.

## 13. Calendar + route + CRM integration

A future visit booking should conceptually synchronize:

`CRM + calendar + visit + route + pipeline`

Example flow:

`Customer requests visit -> assistant checks calendar -> checks geography -> evaluates route -> proposes suitable slot -> customer confirms -> appointment/CRM/route updated`

Human approval rules must be defined before automatic calendar changes are enabled.

## 14. Visits

Candidate visit record:

- company/contact
- address/geolocation
- date/time
- duration
- route
- status
- notes
- result
- next action

Candidate statuses:
- scheduled
- confirmed
- completed
- rescheduled
- cancelled
- no-show/not completed

## 15. Results and analytics

Track the funnel:

`LEAD -> CONTACT -> CONVERSATION -> QUALIFIED -> INTEREST -> NEGOTIATION -> HUMAN -> CONVERSION -> RESULT`

Break down by:
- source
- campaign
- segment
- CNAE
- company size
- region
- score
- pipeline stage

## 16. Dashboard

Future dashboard should expose at minimum:

- total leads
- new leads
- qualified leads
- hot leads
- conversations
- awaiting human
- scheduled follow-ups
- scheduled visits
- route workload
- conversions
- lost leads
- conversion rate
- source performance
- score distribution

## 17. Reports/export

Candidate secondary capabilities:
- CSV export
- Excel export
- commercial reports

The CRM/Supabase remains the source of truth; spreadsheets are exports only.

## 18. Deliberately excluded

Do not adopt as core project functionality:

- mass messaging as the primary strategy
- chip pools
- number warming
- spam/volume-oriented WhatsApp operation
- sales academy modules
- HR/administrative modules from external systems
- AK-specific internal operational modules
- complex supervisor/manager hierarchy at this stage
- unrelated white-label/multiclient expansion

## 19. Future sequencing

### Preserve and stabilize first
- existing V1 WhatsApp flow
- SDR state machine
- Supabase persistence
- authorized CNPJ flow
- human handoff
- security
- tests/regressions

### Candidate next functional layers
- richer CRM fields
- lead score
- conversation analysis
- deduplication/enrichment
- dashboard/analytics
- prospecting
- follow-up engine
- calendar integration
- geolocation/route planning

### Later scale
- advanced imports
- multiple users/teams
- multiple WhatsApps
- advanced calendar automation
- broader omnichannel capabilities

## 20. Non-negotiable constraints

- Do not add a second WhatsApp during V1 development, testing, or validation.
- Do not expose API keys in frontend/client code.
- Do not put secrets in prompts.
- Do not fabricate external data.
- Do not promise credit/product approval.
- Do not bypass `AGUARDANDO_RETORNO_DO_LUIS` automatically.
- Do not introduce paid services automatically; prefer free/open-source/free-tier options when technically viable.
- Any future implementation must first be compared against the V1 Golden Spec, acceptance tests, regression matrix, and project rules.
