#!/bin/bash
set -ex

docker run --rm -it \
    --name coturn \
    --network=host \
    -v $(pwd)/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
    coturn/coturn
