# Project rules

- Keep reminder windows and booking-email deduplication keys in the shared reminder rules module so both email functions agree on reminder identity.
- Interpret booking date/time in Europe/Zagreb through date-fns-tz so scheduled reminders follow local appointment time across daylight saving changes.