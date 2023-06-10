#!/bin/bash
set -ex

WORKDIR=$(pwd)/frontend

docker run --rm -it \
    -v $WORKDIR:$WORKDIR \
    -w $WORKDIR \
    node:18 yarn build