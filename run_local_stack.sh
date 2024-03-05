#!/bin/bash
set -ex
# TODO add --build flag by default but add ability to not build when offline
docker compose -f docker-compose.local.yml up --build --remove-orphans
