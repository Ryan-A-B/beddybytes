# BeddyBytes
Privacy-first baby monitor that works entirely in the browser.

**What It Is**
- Progressive Web App (PWA) that turns existing devices into baby monitors.
- Requires at least two devices: one Baby Station and one Parent Station.
- Supports multiple Baby Stations and multiple Parent Stations.

**How It Works**
- Baby Stations capture audio (required) and camera video (optional) and expose a WebRTC media stream.
- Parent Stations initiate WebRTC connections to Baby Stations and display the stream.
- Signaling is handled by a backend over WebSockets.
- Media flows peer-to-peer; the backend is only for connection setup.

**Why It Matters**
- Reuse phones, tablets, or laptops you already own.
- No dedicated hardware required.
- Privacy-first design: no cloud video storage.
- Audio/video never leave the home network; the backend never sees or relays media.

**Quick Start (Users)**
- Open BeddyBytes in a modern browser on two devices.
- Choose Baby Station on the device in the nursery.
- Choose Parent Station on the device you want to monitor from.
- Pair and start streaming.
- Video walkthrough: https://www.youtube.com/watch?v=uQHlMu7m5us

**Repository Map**
- `frontend/` - PWA user interface and WebRTC client logic.
- `golang/` - Backend services (signaling, accounts, licensing).
- `marketing/` - Public website and landing pages.
- `integration_tests/` - End-to-end test scenarios.
- `cloudformation/`, `traefik/`, `grafana/`, `influxdb/` - Infrastructure and observability.

**Local Dev TLS Setup**
- Install `mkcert` on your machine.
- Run `mkcert -install` once on each machine. This creates a local root CA and adds it to your trust stores.
- Generate the repo's local TLS certs with `make -C traefik/certificates`.
- The generated `beddybytes.local.crt` and `beddybytes.local.key` are leaf certs signed by that trusted local CA, so browsers on the same machine will trust them automatically.
- If you work across multiple repos on the same machine, each repo can generate its own leaf certs with `mkcert` and they will all chain back to the same trusted local CA.

**License (Open Source)**
- BeddyBytes is open-source software under the GNU General Public License, version 2 or (at your option) any later version (`GPL-2.0-or-later`).
- You may run, study, modify, and redistribute BeddyBytes under those terms.
- See `LICENSE.md` for the full license text.

**LLM Context**
- Product goal: private, browser-based baby monitoring with minimal infrastructure.
- Network model: WebRTC peer connections; signaling via WebSockets; parents initiate.
- Media plane: local-network only; no STUN/TURN servers; ICE candidates are local.
- Roles: Baby Station accepts connections; Parent Station controls session setup.
- Multi-station support: multiple parents and multiple babies can be active.
- Privacy stance: no media storage on servers; signaling only; backend never handles media.
- Internet requirement: currently required for accounts and signaling, even though media stays local.

**Links**
```text
Website: https://beddybytes.com
YouTube: https://www.youtube.com/@BeddyBytes
Getting started video: https://www.youtube.com/watch?v=uQHlMu7m5us
```
