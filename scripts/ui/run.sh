#!/bin/bash
set -ex

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

workdir="$REPO_ROOT/ui"
port="${UI_PORT:-5176}"

docker run --rm -it \
    --name beddybytes-ui \
    -p "$port:$port" \
    -v "$workdir:$workdir" \
    -w "$workdir" \
    -e CHOKIDAR_USEPOLLING=true \
    --network=agent-net \
    node:18 \
    bash -lc "if [ ! -d node_modules ]; then npm install; fi; npm run dev -- --port $port"
