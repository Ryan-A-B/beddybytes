#!/bin/bash
set -ex

workdir=$(pwd)/frontend

docker run --rm -it \
    -e REACT_APP_BUILD_TIMESTAMP=$(date +"%Y-%m-%dT%H:%M:%S%z") \
    -e REACT_APP_BUILD_HASH=$(git rev-parse HEAD) \
    -v $(pwd):$(pwd) \
    -w $workdir \
    node:18 yarn build