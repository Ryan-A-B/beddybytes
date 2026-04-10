## Current State

- Legacy signalling path uses backend WebSockets.
- MQTT migration is active for backend ingress/egress topic contracts.
- Backend now:
  - publishes client status to `accounts/{account_id}/clients/{client_id}/status`
  - publishes WebRTC signalling to `accounts/{account_id}/clients/{client_id}/webrtc_inbox`
  - subscribes `baby_stations`, `parent_stations`, `webrtc_inbox`, and status wildcard topics
  - keeps `PUT /sessions/{session_id}` on the legacy request payload and derives the MQTT announcement fields server-side, including `session_id`
  - queues `PUT /sessions/{session_id}` session starts in-memory when `client_id` is unresolved and flushes on websocket connect
  - appends `session.ended` on explicit delete for old clients and on clean disconnect for compatibility with future clients that end sessions by disconnecting
- Current direction:
  - `session_id` stays
  - `connection_id` is being reduced to compatibility/runtime identity rather than long-term primary identity
- Current implementation is backend-centric; no finalized frontend MQTT path yet.

See [[Backend Signalling Contracts]] for current endpoint/topic details.

## Direction

- Move clients to direct MQTT-first signalling behavior.
- Deprecate WebSocket endpoints.
- Remove WebSocket signalling paths after migration is complete and safe.

## Risk Factors

- PWA caching causes version skew across active clients.
- Mixed fleets (WebSocket-era and MQTT-era clients) must interoperate during rollout.
- Session continuity and reconnection behavior must remain stable while transports coexist.

## Documentation Impact

As migration advances, update:

- [[architecture]] for control-plane transport changes.
- [[structure]] for source-of-truth files handling signalling.
- [[Backend Signalling Contracts]] as backend transport behavior changes.
