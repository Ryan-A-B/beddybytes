#!/bin/bash
set -ex

docker run --rm -it \
    -p 80:80 \
    -p 443:443 \
    -v $(pwd)/nginx/default.conf:/etc/nginx/conf.d/default.conf \
    -v $(pwd)/nginx/cert.pem:/etc/nginx/certs/cert.pem \
    -v $(pwd)/nginx/key.pem:/etc/nginx/certs/key.pem \
    -v $(pwd)/public:/usr/share/nginx/html \
    nginx:alpine
