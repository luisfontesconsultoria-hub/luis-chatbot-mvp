# Command Center

The daily command center is the operational view of the commercial assistant.

It consolidates persisted CRM events, explicitly supplied appointments, and explicitly supplied route stops. It does not call external calendar or maps providers and does not invent travel time, traffic, availability, or geocoding.

## Data flow

CRM/Supabase -> events -> daily operations -> appointments -> route stops -> command center.

## Safety

- Authentication remains mandatory at the HTTP boundary.
- Supabase remains the persistence source of truth.
- V1 remains limited to one WhatsApp.
- External integrations must be implemented behind adapters with real credentials.
- Route optimization is `priority_only` when real travel minutes are absent.
- Route optimization is `priority_then_travel_time` only when travel minutes are explicitly present.

## Future adapters

Calendar and maps/geocoding can be attached without changing the command-center contract. They must supply verified data and preserve the deterministic fallback behavior.
