#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "${SCRIPT_DIR}/gradle.sh" spotlessCheck :app:testLocalDebugUnitTest :app:lintLocalDebug
