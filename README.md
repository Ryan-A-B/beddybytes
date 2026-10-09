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
- `./run_local_stack.sh` calls `./setup_local_stack.sh` before starting Compose.
- The setup script checks the local certificate and private key.
- When either file is missing, invalid, expired, or mismatched, the script runs `mkcert -install` and generates a fresh pair.
- Setup is skipped when the existing certificate and private key are usable.
- The generated `beddybytes.local.crt` and `beddybytes.local.key` are leaf certs signed by that trusted local CA, so browsers on the same machine will trust them automatically.
- If you work across multiple repos on the same machine, each repo can generate its own leaf certs with `mkcert` and they will all chain back to the same trusted local CA.

The app and marketing containers install their locked JavaScript dependencies before starting their development servers. Their `node_modules` directories live in Docker volumes rather than the host checkout.

**Local Secrets with SOPS**

Local runtime secrets are stored in `config/local.sops.env` using SOPS and age. The encrypted file travels with the repository. The private age identity stays outside the repository.

One person must initialize the encrypted file:

1. Install [SOPS](https://github.com/getsops/sops) and [age](https://github.com/FiloSottile/age).
2. Create an age identity outside the repository if you do not already have one:

   ```sh
   mkdir -p ~/.config/sops/age
   age-keygen -o ~/.config/sops/age/keys.txt
   age-keygen -y ~/.config/sops/age/keys.txt
   ```

3. Replace `age1REPLACE_WITH_YOUR_AGE_RECIPIENT` in `.sops.yaml` with the public recipient printed by the last command.
4. Create the encrypted configuration and open it in the SOPS editor:

   ```sh
   cp .env.example config/local.sops.env
   sops encrypt --in-place config/local.sops.env
   sops config/local.sops.env
   ```

5. Replace every placeholder in the editor. `TINYANALYTICS_WRITE_TOKEN` must be signed by `JWT_SIGNING_KEY`.
6. Commit `.sops.yaml` and `config/local.sops.env`. Never commit the age identity or a decrypted `.env` file.

After cloning, an authorized developer installs the matching age identity at `~/.config/sops/age/keys.txt` or sets `SOPS_AGE_KEY_FILE` to its location. Start the local stack with:

```sh
./run_local_stack.sh
```

The script uses `sops exec-env` to pass decrypted values to Docker Compose without writing a plaintext `.env` file. Set `BEDDYBYTES_SOPS_ENV_FILE` to use a different encrypted environment file.

**Marketing Build and Deployment with SOPS**

The marketing build and deployment scripts read `config/marketing.sops.env` through `sops exec-env`. The file carries the TinyAnalytics build values and the AWS deployment destination. Create it with:

```sh
cp config/marketing.env.example config/marketing.sops.env
sops encrypt --in-place config/marketing.sops.env
sops config/marketing.sops.env
```

Replace every placeholder in the SOPS editor. Then build and deploy with:

```sh
./scripts/marketing/build.sh
./scripts/marketing/push.sh
```

The decrypted values remain in the child process environment. No plaintext environment file is written during the build or deployment. Set `BEDDYBYTES_MARKETING_SOPS_ENV_FILE` to use a different encrypted file.

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
