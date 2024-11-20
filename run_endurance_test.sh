#!/bin/bash
set -e

pushd integration_tests
source venv/bin/activate
python src/endurance_test.py
deactivate
popd
