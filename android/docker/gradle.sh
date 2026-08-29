#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
IMAGE_NAME="beddybytes-android-build:gradle-9.7.1-agp-9.3.2"
CACHE_DIR="${PROJECT_DIR}/.gradle-docker"

mkdir -p "${CACHE_DIR}"

docker build \
    --platform linux/amd64 \
    --tag "${IMAGE_NAME}" \
    --file "${SCRIPT_DIR}/Dockerfile" \
    "${SCRIPT_DIR}"

docker run --rm \
    --platform linux/amd64 \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env GRADLE_USER_HOME=/workspace/.gradle-docker \
    --volume "${PROJECT_DIR}:/workspace" \
    --workdir /workspace \
    "${IMAGE_NAME}" \
    ./gradlew --no-daemon "$@"
