#!/bin/bash
set -ex

WORKDIR=$(pwd)/frontend

docker run --rm -it \
    --network=host \
    -v $WORKDIR:$WORKDIR \
    -w $WORKDIR \
    node:18 /bin/bash