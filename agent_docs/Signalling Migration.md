## Current State

- Legacy signalling path uses backend WebSockets.
- MQTT migration is active for backend ingress/egress topic contracts.
- Backend now:
  - publishes client status to `accounts/{account_id}/clients/{client_id}/status`
  - publishes WebRTC signalling to `accounts/{account_id}/clients/{client_id}/webrtc_inbox`
  - subscribes `baby_stations`, `parent_stations`, `webrtc_inbox`, and status wildcard topics
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
