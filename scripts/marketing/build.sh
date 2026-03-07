#!/bin/bash
set -ex

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/init.sh"

workdir=$(pwd)/marketing

docker run --rm -it \
    -v $workdir:$workdir \
    -w $workdir \
    -e TINYANALYTICS_ENDPOINT=${TINYANALYTICS_ENDPOINT:-https://analytics.beddybytes.com} \
    -e TINYANALYTICS_WRITE_TOKEN=${TINYANALYTICS_WRITE_TOKEN:-} \
    node:18 npm run build
