#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

encrypted_env="${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}"

if ! command -v sops >/dev/null 2>&1; then
    echo "sops is required. Install it before starting BeddyBytes." >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "Docker with the Compose plugin is required." >&2
    exit 1
fi

if [[ ! -f "$encrypted_env" ]]; then
    echo "$encrypted_env is missing." >&2
    echo "Create and encrypt it by following the SOPS setup in README.md." >&2
    exit 1
fi

./setup_local_stack.sh

cleanup() {
    docker compose -f docker-compose.yml rm --force --volumes
}

trap cleanup EXIT

# TODO add --build flag by default but add ability to not build when offline
# docker compose -f docker-compose.yml up --build --remove-orphans --watch
sops exec-env --same-process "$encrypted_env" \
    'docker compose -f docker-compose.yml up --build --remove-orphans'
