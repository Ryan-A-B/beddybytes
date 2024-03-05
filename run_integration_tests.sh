#!/bin/bash
set -ex

docker compose -f docker-compose.local.yml \
    exec -it integration_tests python run.py
