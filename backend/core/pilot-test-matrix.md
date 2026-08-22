# V1 Real Pilot Test Matrix

| Test | Expected result | Status |
|---|---|---|
| Text inbound | Lead created/updated and response sent | PENDING REAL ENV |
| Duplicate webhook | No duplicate lead/reply | PENDING REAL ENV |
| Invalid signature | HTTP 403 / rejected | PENDING REAL ENV |
| Unauthorized phone ID | Blocked before SDR | PENDING REAL ENV |
| Human handoff | Automation stops | PENDING REAL ENV |
| Luis return/release | Authorized transition only | PENDING REAL ENV |
| Audio inbound | Transcribed and enters same pipeline | PENDING REAL ENV |
| AI unavailable | Safe fallback/error path | PENDING REAL ENV |
| Supabase unavailable | Bounded failure/retry | PENDING REAL ENV |
| Kill switch | Processing stops immediately | PENDING REAL ENV |
| Low-volume operation | No bulk outbound behavior | PENDING REAL ENV |

**Pass condition:** every row must be executed against the real pilot environment before declaring V1 100%.
