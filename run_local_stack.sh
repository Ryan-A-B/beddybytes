#!/bin/bash
set -ex

cleanup() {
    docker compose -f docker-compose.local.yml rm --force --volumes
}

trap cleanup EXIT

# TODO add --build flag by default but add ability to not build when offline
docker compose -f docker-compose.local.yml up --build --remove-orphans --watch