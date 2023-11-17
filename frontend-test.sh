#!/bin/bash
set -ex

workdir=$(pwd)/frontend

docker run --rm -it \
    -v $workdir:$workdir \
    -w $workdir \
    node:18 yarn test $@