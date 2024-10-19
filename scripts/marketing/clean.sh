#!/bin/bash
set -ex

pushd marketing
sudo rm -rf public .cache
popd
docker compose -f docker-compose.local.yml restart marketing