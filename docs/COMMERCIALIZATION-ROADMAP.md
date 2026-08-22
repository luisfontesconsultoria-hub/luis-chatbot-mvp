# Commercialization Roadmap

## Phase 1 — V1 owner deployment
- One WhatsApp number
- One tenant
- No billing enforcement
- Real pilot and stabilization

## Phase 2 — Commercial foundation
- Tenant provisioning
- Signed license per tenant
- Tenant-isolated CRM/data
- Admin license management
- Audit trail for license changes
- Subscription/payment integration

## Phase 3 — Customer deployment
- Customer-specific WhatsApp credentials
- Customer-specific Meta assets
- Customer-specific OpenAI configuration/policy
- Usage limits and plan entitlements
- Suspension/expiration enforcement

## Phase 4 — SaaS operations
- Admin dashboard
- Billing status synchronization
- Automated renewal/expiration
- Customer onboarding/offboarding
- Backups and support procedures

## Security rules
- Never share master signing secrets with customers.
- Never place license signing secrets in browser code.
- Never use a GitHub repository as the license authority.
- Payment status must be reconciled server-side before changing access.
- Keep tenant data isolated even when a license is inactive.

## V1 constraint
Commercialization work must not activate additional WhatsApp numbers or alter the approved commercial SDR flow before V1 passes its real release gate.
