#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
encrypted_env="${BEDDYBYTES_BACKEND_SOPS_ENV_FILE:-$repo_root/config/backend.sops.env}"

if ! command -v sops >/dev/null 2>&1; then
  echo "sops is required to start the backend CloudFormation shell." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to start the backend CloudFormation shell." >&2
  exit 1
fi

if [[ ! -f "$encrypted_env" ]]; then
  echo "$encrypted_env is missing." >&2
  exit 1
fi

sops exec-file "$encrypted_env" '
  docker run -it --rm \
    -v "$PWD:$PWD" \
    -w "$PWD" \
    --env-file "{}" \
    --dns 8.8.8.8 \
    --dns 8.8.4.4 \
    node:22 /bin/bash
'
