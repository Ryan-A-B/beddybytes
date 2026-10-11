#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ] || [ -z "${1:-}" ]; then
  echo "Usage: $0 <stack_name>"
  exit 1
fi

export BEDDYBYTES_DEPLOY_STACK=$1
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
encrypted_env="${repo_root}/config/backend.sops.env"

cd "${repo_root}/cloudformation/backend"

sops exec-file "$encrypted_env" '
  docker run -it --rm \
    -v "$PWD:$PWD" \
    -w "$PWD" \
    --env-file "{}" \
    --dns 8.8.8.8 \
    --dns 8.8.4.4 \
    node:22 npm run cdk -- deploy "$BEDDYBYTES_DEPLOY_STACK"
'
