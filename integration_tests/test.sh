#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v

cd src
# python -m unittest tests.test_recording
# python -m unittest tests.test_session.TestSession.test_video_session
# python -m unittest tests.test_recording.TestAccountManagement.test_reset_password