#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v

cd src
# python -m unittest -v tests.test_session.TestSession
# python -m unittest -v tests.test_session.TestSession.test_restart_and_reconnect_session