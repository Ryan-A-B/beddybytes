#!/bin/bash
set -ex

cleanup() {
    docker compose -f docker-compose.yml rm --force --volumes
}

trap cleanup EXIT

# TODO add --build flag by default but add ability to not build when offline
# docker compose -f docker-compose.yml up --build --remove-orphans --watch
docker compose -f docker-compose.yml up --build --remove-orphans