#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)

exec "${REPOSITORY_DIR}/android/docker/verify-clean.sh" "$@"
