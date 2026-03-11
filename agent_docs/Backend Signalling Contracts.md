## Purpose

This note documents the current backend signalling contracts and where they are implemented.

## Source-of-Truth Files

- `golang/cmd/backend/server.go`
- `golang/cmd/backend/Connection.go`
- `golang/cmd/backend/MQTTSync.go`
- `golang/internal/connectionstoresync/Sync.go`
- `golang/internal/connections/Event.go`

## Active Signalling Endpoints

Registered in `golang/cmd/backend/server.go`:

- `GET /clients/{client_id}/websocket`
- `GET /clients/{client_id}/connections/{connection_id}`
- `PUT /sessions/{session_id}`
- `DELETE /sessions/{session_id}` (no-op)

Both routes are behind auth middleware under `/clients`.

## Legacy WebSocket Signalling Route

`GET /clients/{client_id}/websocket` in `server.go` + `HandleWebsocket`:

- Legacy peer-to-peer relay via backend in-memory `ClientStore`.
- Inbound JSON:
  - `to_peer_id: string`
  - `data: any JSON`
- Outbound JSON:
  - `from_peer_id: string`
  - `data: any JSON`

This is the legacy transport targeted for deprecation after MQTT migration.

## Connection Route: WebSocket Transport + MQTT Relay

`GET /clients/{client_id}/connections/{connection_id}` in `Connection.go`:

- Upgrades to WebSocket.
- Publishes connect status to:
  - `accounts/{account_id}/clients/{client_id}/status`
  - payload: `{"type":"connected","connection_id":"...","at_millis":<int>}`
- Publishes disconnect status to:
  - `accounts/{account_id}/clients/{client_id}/status`
  - payload: `{"type":"disconnected","connection_id":"...","disconnected":{"reason":"clean|unexpected"},"at_millis":<int>}`
- Incoming websocket payload from client:
  - `{"type":"signal","signal":{"to_connection_id":"...","data":<json>}}`
  - backend republishes to MQTT topic:
  - `accounts/{account_id}/clients/{to_client_id|sender_client_id}/webrtc_inbox`
  - payload: `{"from_client_id":"...","connection_id":"...","data":<json>}`
- Keepalive:
  - websocket ping/pong with 30s ping period
  - pong timeout 10s
- Active websocket connections are tracked in-memory via `ConnectionHub`.

## MQTT Topics

Defined in `Connection.go` and `MQTTSync.go`:

- Status topic format:
  - `accounts/%s/clients/%s/status`
- WebRTC inbox:
  - `accounts/%s/clients/%s/webrtc_inbox`
- Baby stations:
  - `accounts/%s/baby_stations`
- Parent stations:
  - `accounts/%s/parent_stations`
- Control inbox:
  - `accounts/%s/clients/%s/control_inbox`

Status sync subscriber in `connectionstoresync/Sync.go`:

- Subscribes wildcard:
  - `accounts/+/clients/+/status`
- Parses account and client IDs from topic, then uses payload `connection_id`.

## MQTT Status Payloads

Published from `Connection.go` on connect/disconnect:

- Connected:
  - `{"type":"connected","connection_id":"...","at_millis":<int>}`
- Disconnected:
  - `{"type":"disconnected","connection_id":"...","disconnected":{"reason":"clean|unexpected"},"at_millis":<int>}`

Event payloads are defined in `golang/internal/connections/Event.go`.

## Session Ingress/Egress

- `PUT /sessions/{session_id}` now publishes session announcements to:
  - `accounts/{account_id}/baby_stations`
- `PUT /sessions/{session_id}` accepts both:
  - legacy payload (`id`, `name`, `host_connection_id`, `started_at`)
  - migration payload (`client_id`, `connection_id`, `name`, `started_at_millis`)
- If `client_id` is missing, backend resolves it from in-memory connection map (`connection_id -> client_id`).
- If mapping is not available yet, backend queues session start in-memory and publishes after websocket connect registers that connection.
- Queue policy: per-account LRU with max 2 pending session starts.
- Session delete endpoint is intentionally no-op; disconnect status drives lifecycle.
- `MQTTSync` subscribes `accounts/+/baby_stations` and appends `session.started` with idempotency via `sessionstartdecider`.

## Parent Station Discovery

- `MQTTSync` subscribes `accounts/+/parent_stations`.
- Expected payload includes `client_id` of requesting parent station.
- For each active baby station snapshot entry, backend publishes control message:
  - topic: `accounts/{account_id}/clients/{client_id}/control_inbox`
  - payload:
    - `{"type":"baby_station_announcement","at_millis":<int>,"baby_station_announcement":{"client_id":"...","connection_id":"...","name":"...","started_at_millis":<int>}}`

Client status subscription remains in `connectionstoresync`:

- `accounts/+/clients/+/status`

## Auth and Token Durations

Configured in `golang/cmd/backend/server.go`:

- Access token duration: `1 * time.Hour`
- Refresh token duration: `30 * 24 * time.Hour`

Refresh token scope handling is in `golang/internal/accounts/Handlers.go`.
