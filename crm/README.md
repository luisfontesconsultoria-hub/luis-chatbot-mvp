# CRM V1

The CRM is the operator-facing layer over the existing backend/Supabase data model.

## V1 screens
- Dashboard: lead counts, HOT/WARM/COLD, pipeline totals, acquisition sources.
- Leads: searchable/filterable list with company, contact, source, score, status and next action.
- Lead detail: conversation history, source/attribution, score, routing, notes and audit history.
- Pipeline: New → Qualified → Interested → Proposal → Won/Lost.

## Principles
- CRM is not the database; Supabase remains the persistence layer.
- Browser code never receives server secrets.
- Tenant isolation is enforced server-side.
- V1 is single-tenant and single-WhatsApp.
- Commercial licensing is future infrastructure and does not block the V1 owner dashboard.
