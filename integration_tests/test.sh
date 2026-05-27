#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v

cd src

# python -m unittest -v tests.test_session
# python -m unittest -v tests.test_recording
# python -m unittest -v tests.test_two_baby_stations
# python -m unittest -v tests.test_backend_http_api
# python -m unittest -v tests.test_backend_mqtt

# python -m unittest tests.test_session.TestSession.test_audio_session
# python -m unittest tests.test_session.TestSession.test_video_session
# python -m unittest tests.test_session.TestSession.test_restart_and_reconnect_session
# python -m unittest tests.test_session.TestSession.test_parent_station_recovers_baby_station_list_after_mosquitto_restarts

# python -m unittest tests.test_two_baby_stations.TestTwoBabyStations.test_switching_between_baby_stations
# python -m unittest tests.test_two_baby_stations.TestTwoBabyStations.test_parent_station_second

# python -m unittest tests.test_account_management.TestAccountManagement.test_reset_password

# python -m unittest -v tests.test_backend_mqtt.TestBackendMQTT.test_legacy_websocket_description_signal_is_published_as_mqtt_description
# python -m unittest -v tests.test_backend_mqtt.TestBackendMQTT.test_mqtt_description_signal_is_delivered_as_legacy_websocket_description