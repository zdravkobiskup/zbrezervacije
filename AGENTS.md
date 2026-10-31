# Project rules

- Keep reminder windows and booking-email deduplication keys in the shared reminder rules module so both email functions agree on reminder identity.
- Interpret booking date/time in Europe/Zagreb through date-fns-tz so scheduled reminders follow local appointment time across daylight saving changes.
- Record actual completed-booking material usage through the owner-authorized atomic RPC; reconcile against historical signed transactions instead of deducting norms again, so retries and corrections keep stock accurate.
- Load returning-client suggestions only from business-scoped booking history and existing owner-authorized client lookups; parse manual contact headers in the shared returning-clients module to avoid exposing unrelated profiles or copying appointment notes.