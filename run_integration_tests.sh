#!/bin/bash
set -e

pushd integration_tests
source venv/bin/activate
./test.sh
deactivate
popd
