## System Architecture

BeddyBytes is a privacy-first baby monitor built around browser-native WebRTC.

## Runtime Components

- Frontend PWA (`frontend/`): Baby Station and Parent Station user experience.
- Backend (`golang/`): authentication, session metadata, signalling transport, and account separation.
- Marketing site (`marketing/`): public website and commercial pages.

## Frontend Architecture Pattern

The frontend generally follows a service-oriented model:

- application and workflow state live in services under `frontend/src/services/`
- React components under `frontend/src/pages/` and `frontend/src/components/` render that state
- hooks such as `frontend/src/hooks/useServiceState.ts` adapt service events into React updates

This keeps business logic, timers, and network workflows out of JSX-heavy components.

## Core Roles

- Baby Station: captures microphone audio (required) and camera video (optional), then publishes media to WebRTC peers.
- Parent Station: discovers active sessions, establishes WebRTC peer connections, and plays media.

## Data Plane vs Control Plane

- Data plane (media): browser-to-browser WebRTC, peer-to-peer, local network only.
- Control plane (signalling + auth): backend-mediated session/auth/signalling traffic.

The backend handles signalling metadata and account/session concerns, but not media transport.

## Privacy-Critical Constraints

- No STUN/TURN servers are configured.
- If peers are not on the same local network, WebRTC connection fails.
- Audio/video never leave the home network.
- Recording is local to Parent Station browser via `MediaRecorder` and immediately downloaded.
- Backend never stores or relays media.

## Deployment Overview

- Local development stack: `docker-compose.yml` and `run_local_stack.sh`.
- QA + Prod backend: separate Docker containers on a single EC2 host.
- Shared infra on that host: Traefik, Grafana, InfluxDB.
- Frontend app hosting: S3 + CloudFront, with separate QA and Prod app environments.
- Marketing: production site only.

## Authentication Model

- Account-based access control.
- Access token + refresh token flow (OAuth-like model).
- JWT access token TTL: 1 hour.
- JWT refresh token TTL: 30 days.
- Password reset flow is implemented.

## Payments

- Stripe is used for one-off checkout purchases.
- No subscription billing model.

## Architectural Center of Gravity

The baby station session and WebRTC connection lifecycle are the center of the system. Most backend/frontend logic exists to establish, maintain, recover, and tear down those peer connections.
