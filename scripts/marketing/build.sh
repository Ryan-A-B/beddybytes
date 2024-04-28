#!/bin/bash
set -ex

workdir=$(pwd)/marketing

docker run --rm -it \
    -v $workdir:$workdir \
    -w $workdir \
    node:18 npm run build