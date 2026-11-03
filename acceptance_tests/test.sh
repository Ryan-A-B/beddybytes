#!/bin/bash
set -ex

./ensure_venv.sh

PYTHONPATH=src python -m pytest src/tests -v "$@"
