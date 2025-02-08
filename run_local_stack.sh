#!/bin/bash -ex

cleanup() {
    docker compose -f docker-compose.yml rm --force --volumes
}

trap cleanup EXIT

OFFLINE=false

for arg in "$@"; do
    if [ "$arg" == "--offline" ]; then
        OFFLINE=true
        break
    fi
done

BUILD_FLAGS="--remove-orphans"
if [ "$OFFLINE" == false ]; then
    BUILD_FLAGS="$BUILD_FLAGS --build --watch"
fi

# TODO add --build flag by default but add ability to not build when offline
docker compose -f docker-compose.yml up $BUILD_FLAGS