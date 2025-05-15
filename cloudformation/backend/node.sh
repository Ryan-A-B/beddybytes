#!/bin/bash -ex

docker run -it --rm \
  -v $(pwd):$(pwd) \
  -w $(pwd) \
  --env-file .env \
  --dns 8.8.8.8 \
  --dns 8.8.4.4 \
  node:22 /bin/bash