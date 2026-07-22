#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$repo_root"

encrypted_env="${BEDDYBYTES_MARKETING_SOPS_ENV_FILE:-config/marketing.sops.env}"

if ! command -v sops >/dev/null 2>&1; then
    echo "sops is required to build the marketing site." >&2
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required to build the marketing site." >&2
    exit 1
fi

if [[ ! -f "$encrypted_env" ]]; then
    echo "$encrypted_env is missing." >&2
    echo "Create it from config/marketing.env.example and encrypt it with SOPS." >&2
    exit 1
fi

sops exec-env --same-process "$encrypted_env" '
    set -eu
    : "${TINYANALYTICS_ENDPOINT:?TINYANALYTICS_ENDPOINT is missing from the marketing SOPS file}"
    : "${TINYANALYTICS_WRITE_TOKEN:?TINYANALYTICS_WRITE_TOKEN is missing from the marketing SOPS file}"

    docker run --rm -it \
        -v "$PWD/marketing:/opt/marketing" \
        -w /opt/marketing \
        -e TINYANALYTICS_ENDPOINT \
        -e TINYANALYTICS_WRITE_TOKEN \
        node:18 npm run build
'
