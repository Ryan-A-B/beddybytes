#!/bin/bash -ex

docker run -d --rm \
  --name nginx-forward \
  -p 80:80 \
  -p 443:443 \
  -v ./nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:stable

docker logs -f nginx-forward