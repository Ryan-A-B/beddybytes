#!/bin/bash
set -e

pushd integration_tests
source venv/bin/activate
python src/run_endurance_test.py
deactivate
popd
