The human prefers immediate escalation when implementation issues arise.

## Escalation Preference

- If a refactor exposes missing data, ordering assumptions, or contract ambiguity, raise it immediately.
- Do not silently patch around issues.
- Present the issue and let the human choose the resolution approach.

## Current Applied Example (2026-03-10)

- MQTT `BabyStationAnnouncement` requires `client_id`, but legacy `PUT /sessions/{session_id}` payload does not contain it.
- Frontend Baby Station currently calls session create before opening the websocket connection, so connection-to-client mapping is not guaranteed at create time.
- Human-selected resolution: maintain an in-memory connection map (`connection_id` -> `client_id`) and handle session-create timing accordingly.
