#!/bin/bash
set -ex

./ensure_venv.sh

pip freeze > requirements.txt