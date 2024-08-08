#!/bin/bash
set -ex

workdir=$(pwd)/marketing

docker run --rm -it \
    -v $workdir:$workdir \
    -w $workdir \
    --dns 8.8.8.8 \
    node:18 /bin/bash