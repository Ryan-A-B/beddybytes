## Repository Structure

This note maps where key system behavior lives.

## Product Runtime

- `frontend/`: PWA app, Baby Station + Parent Station logic, WebRTC and client-side recording behavior.
- `golang/`: backend server, signalling/auth/session handling, MQTT and WebSocket infrastructure.
- `marketing/`: Gatsby marketing site.

## Backend Entry Points

- `golang/cmd/backend/`: backend server composition and handlers.
- `golang/internal/`: domain modules (accounts, sessions, connection stores, messaging, event log, stores, MQTT helpers).
- Signalling source-of-truth (current):
  - `golang/cmd/backend/server.go`
  - `golang/cmd/backend/Connection.go`
  - `golang/internal/connectionstoresync/Sync.go`
  - `golang/internal/connections/Message.go`

## Frontend Areas

- `frontend/src/pages/BabyStation/`: baby station UI and media capture/stream behavior.
- `frontend/src/pages/ParentStation/`: parent station UI and playback/session controls.
- `frontend/src/services/SignalService/`: signalling transport implementation.
- `frontend/src/services/BabyStation/` and `frontend/src/services/ParentStation/`: role-specific application services.

## Infra and Ops

- `docker-compose.yml`: local stack.
- `run_local_stack.sh`: local environment bootstrap.
- `run_integration_tests.sh`: integration test entrypoint.
- `integration_tests/`: end-to-end scenarios.
- `cloudformation/`: infrastructure templates.
- `traefik/`, `grafana/`: ingress and observability configuration.

## Product/Domain References

- `README.md`: concise project overview.
- `HowBeddyBytesWorks.md`: concise architecture explanation.
- `HowBeddyBytesWorks2.md`: detailed privacy and architecture narrative.

## Documentation Map

- [[index]]
- [[architecture]]
- [[Frontend Service Architecture]]
- [[Product and Privacy Model]]
- [[Backend Signalling Contracts]]
- [[Signalling Migration]]
- [[Open Questions]]
