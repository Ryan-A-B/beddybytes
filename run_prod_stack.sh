#!/bin/bash
set -ex

docker compose -f docker-compose.prod.yml up --build --remove-orphans -d