#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v

cd src
# python -m unittest tests.test_session.TestSession.test_audio_session
# python -m unittest tests.test_session.TestSession.test_video_session
# python -m unittest tests.test_session.TestSession.test_restart_and_reconnect_session
# python -m unittest tests.test_two_baby_stations.TestTwoBabyStations.test_switching_between_baby_stations
# python -m unittest tests.test_two_baby_stations.TestTwoBabyStations.test_parent_station_second
# python -m unittest tests.test_recording
# python -m unittest tests.test_recording.TestAccountManagement.test_reset_password