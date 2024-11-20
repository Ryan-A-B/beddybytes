#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v