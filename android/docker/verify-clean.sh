#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)
IMAGE_NAME="beddybytes-android-build:clean-verification"

docker build \
    --no-cache \
    --platform linux/amd64 \
    --tag "${IMAGE_NAME}" \
    --file "${SCRIPT_DIR}/Dockerfile" \
    "${SCRIPT_DIR}"

docker run --rm \
    --platform linux/amd64 \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env GRADLE_USER_HOME=/tmp/gradle-home \
    --volume "${PROJECT_DIR}:/workspace" \
    --workdir /workspace \
    "${IMAGE_NAME}" \
    ./gradlew \
    --no-daemon \
    --project-cache-dir /tmp/gradle-project-cache \
    clean spotlessCheck :app:testQaDebugUnitTest :app:lintQaDebug :app:assembleQaDebug
