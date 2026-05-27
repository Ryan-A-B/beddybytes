import json
import queue
import threading
import unittest
import time
from urllib.parse import urlencode

import trio
from selenium import webdriver
from selenium.common.exceptions import StaleElementReferenceException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
from trio_websocket import open_websocket_url

from backend_api_utils import BackendAPIClient, open_connection_websocket_until_signaled, receive_signal_over_connection, send_signal_over_connection, utc_now_seconds_rfc3339, websocket_ssl_context
from mqtt_test_utils import MQTTPublisher, MQTTSubscription
from settings import api_websocket_base_url, app_base_url, chrome_options, hub_url
from utils import generate_random_string, login, wait_for_session_running


class TestBackendMQTT(unittest.TestCase):
    def test_start_session_publishes_client_status_and_baby_station_announcement_messages(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        status_topic = f"accounts/{account_id}/clients/{client_id}/status"
        baby_stations_topic = f"accounts/{account_id}/baby_stations"

        with MQTTSubscription([status_topic, baby_stations_topic]) as subscription:
            response = client.start_session(access_token, session_id, {
                "id": session_id,
                "name": "Nursery",
                "host_connection_id": connection_id,
                "started_at": started_at,
            })
            self.assertEqual(response.status_code, 200, response.text)

            async def run_flow():
                ready_event = trio.Event()
                release_event = trio.Event()
                async with trio.open_nursery() as nursery:
                    nursery.start_soon(
                        open_connection_websocket_until_signaled,
                        access_token,
                        client_id,
                        connection_id,
                        ready_event,
                        release_event,
                    )
                    await ready_event.wait()

                    messages = await subscription.wait_for_messages_async(
                        2,
                        predicate=lambda message: message["topic"] in {status_topic, baby_stations_topic},
                    )

                    release_event.set()
                    return messages

            messages = trio.run(run_flow)

        self.assertEqual(len(messages), 2)
        message_by_topic = {
            message["topic"]: message["payload"]
            for message in messages
        }
        self.assertEqual(set(message_by_topic.keys()), {status_topic, baby_stations_topic})

        status_payload = message_by_topic[status_topic]
        self.assertEqual(status_payload["type"], "connected")
        self.assertEqual(status_payload["connection_id"], connection_id)
        self.assertIn("request_id", status_payload)
        self.assertTrue(status_payload["request_id"])
        self.assertIn("at_millis", status_payload)

        announcement_payload = message_by_topic[baby_stations_topic]
        self.assertEqual(announcement_payload["type"], "announcement")
        self.assertIn("at_millis", announcement_payload)
        self.assertEqual(announcement_payload["announcement"]["client_id"], client_id)
        self.assertEqual(announcement_payload["announcement"]["connection_id"], connection_id)
        self.assertEqual(announcement_payload["announcement"]["session_id"], session_id)
        self.assertEqual(announcement_payload["announcement"]["name"], "Nursery")
        self.assertEqual(announcement_payload["announcement"]["started_at_millis"], announcement_payload["at_millis"])

    def test_connected_status_and_baby_station_announcement_messages_create_session_list_entry(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        request_id = generate_random_string(24)

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        status_topic = f"accounts/{account_id}/clients/{client_id}/status"
        baby_stations_topic = f"accounts/{account_id}/baby_stations"
        published_at_millis = int(time.time() * 1000)

        with MQTTPublisher() as publisher:
            publisher.publish_json(status_topic, {
                "type": "connected",
                "connection_id": connection_id,
                "request_id": request_id,
                "at_millis": published_at_millis,
            })
            publisher.publish_json(baby_stations_topic, {
                "type": "announcement",
                "at_millis": published_at_millis,
                "announcement": {
                    "client_id": client_id,
                    "connection_id": connection_id,
                    "session_id": session_id,
                    "name": "Nursery",
                    "started_at_millis": published_at_millis,
                },
            })

        events = client.wait_for_matching_events(
            access_token,
            count=2,
            predicate=lambda event: event["type"] in {"client.connected", "session.started"},
            from_cursor=0,
        )

        self.assertEqual(len(events), 2)
        event_by_type = {
            event["type"]: event
            for event in events
        }
        self.assertEqual(set(event_by_type.keys()), {"client.connected", "session.started"})

        connected_event = event_by_type["client.connected"]
        self.assertEqual(connected_event["data"]["client_id"], client_id)
        self.assertEqual(connected_event["data"]["connection_id"], connection_id)
        self.assertEqual(connected_event["data"]["request_id"], request_id)

        session_started_event = event_by_type["session.started"]
        self.assertEqual(session_started_event["data"]["id"], session_id)
        self.assertEqual(session_started_event["data"]["name"], "Nursery")
        self.assertEqual(session_started_event["data"]["host_connection_id"], connection_id)

        session_list = client.list_sessions(access_token)
        sessions = session_list["sessions"]
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["id"], session_id)
        self.assertEqual(sessions[0]["name"], "Nursery")
        self.assertEqual(sessions[0]["host_connection_id"], connection_id)
        self.assertIn("started_at", sessions[0])

    def test_unexpected_mqtt_disconnect_writes_client_disconnected_event_and_removes_session_from_session_list(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)
        status_topic = f"accounts/{account_id}/clients/{client_id}/status"

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": "Nursery",
            "host_connection_id": connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)

        async def run_flow():
            ready_event = trio.Event()
            release_event = trio.Event()
            async with trio.open_nursery() as nursery:
                nursery.start_soon(
                    open_connection_websocket_until_signaled,
                    access_token,
                    client_id,
                    connection_id,
                    ready_event,
                    release_event,
                )
                await ready_event.wait()

                setup_events = client.wait_for_matching_events(
                    access_token,
                    count=2,
                    predicate=lambda event: event["type"] in {"client.connected", "session.started"},
                    from_cursor=0,
                )
                setup_cursor = max(event["logical_clock"] for event in setup_events)
                connected_event = next(event for event in setup_events if event["type"] == "client.connected")

                with MQTTPublisher() as publisher:
                    publisher.publish_json(status_topic, {
                        "type": "disconnected",
                        "connection_id": connection_id,
                        "request_id": connected_event["data"]["request_id"],
                        "at_millis": int(time.time() * 1000),
                        "disconnected": {
                            "reason": "unexpected",
                        },
                    })

                events = client.wait_for_matching_events(
                    access_token,
                    count=1,
                    predicate=lambda event: event["type"] == "client.disconnected",
                    from_cursor=setup_cursor,
                )

                release_event.set()
                nursery.cancel_scope.cancel()
                return connected_event, events[0]

        connected_event, disconnected_event = trio.run(run_flow)

        self.assertEqual(disconnected_event["type"], "client.disconnected")
        self.assertEqual(disconnected_event["data"]["client_id"], client_id)
        self.assertEqual(disconnected_event["data"]["connection_id"], connection_id)
        self.assertEqual(disconnected_event["data"]["request_id"], connected_event["data"]["request_id"])

        session_list = client.list_sessions(access_token)
        self.assertEqual(len(session_list["sessions"]), 0)

    def test_parent_station_announcement_publishes_control_inbox_message_for_http_created_session(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        baby_client_id = generate_random_string(24)
        baby_connection_id = generate_random_string(24)
        parent_client_id = generate_random_string(24)
        parent_connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        control_inbox_topic = f"accounts/{account_id}/clients/{parent_client_id}/control_inbox"
        parent_stations_topic = f"accounts/{account_id}/parent_stations"

        with MQTTSubscription([control_inbox_topic]) as subscription:
            response = client.start_session(access_token, session_id, {
                "id": session_id,
                "name": "Nursery",
                "host_connection_id": baby_connection_id,
                "started_at": started_at,
            })
            self.assertEqual(response.status_code, 200, response.text)

            async def run_flow():
                ready_event = trio.Event()
                release_event = trio.Event()
                async with trio.open_nursery() as nursery:
                    nursery.start_soon(
                        open_connection_websocket_until_signaled,
                        access_token,
                        baby_client_id,
                        baby_connection_id,
                        ready_event,
                        release_event,
                    )
                    await ready_event.wait()

                    client.wait_for_matching_events(
                        access_token,
                        count=2,
                        predicate=lambda event: event["type"] in {"client.connected", "session.started"},
                        from_cursor=0,
                    )

                    with MQTTPublisher() as publisher:
                        publisher.publish_json(parent_stations_topic, {
                            "type": "announcement",
                            "at_millis": int(time.time() * 1000),
                            "announcement": {
                                "client_id": parent_client_id,
                                "connection_id": parent_connection_id,
                            },
                        })

                    messages = await subscription.wait_for_messages_async(
                        1,
                        predicate=lambda message: message["topic"] == control_inbox_topic,
                    )
                    release_event.set()
                    return messages

            messages = trio.run(run_flow)

        self.assertEqual(len(messages), 1)
        payload = messages[0]["payload"]
        self.assertEqual(payload["type"], "baby_station_announcement")
        self.assertIn("at_millis", payload)
        announcement = payload["baby_station_announcement"]
        self.assertEqual(announcement["client_id"], baby_client_id)
        self.assertEqual(announcement["connection_id"], baby_connection_id)
        self.assertEqual(announcement["session_id"], session_id)
        self.assertEqual(announcement["name"], "Nursery")
        self.assertIn("started_at_millis", announcement)

    def test_websocket_signal_is_published_to_target_client_webrtc_inbox(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        target_request_id = generate_random_string(24)
        signal_data = {
            "type": "offer",
            "sdp": "test-offer",
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        target_status_topic = f"accounts/{account_id}/clients/{target_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        with MQTTSubscription([target_webrtc_inbox_topic]) as subscription:
            with MQTTPublisher() as publisher:
                publisher.publish_json(target_status_topic, {
                    "type": "connected",
                    "connection_id": target_connection_id,
                    "request_id": target_request_id,
                    "at_millis": int(time.time() * 1000),
                })

            client.wait_for_matching_events(
                access_token,
                count=1,
                predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == target_connection_id,
                from_cursor=0,
            )

            trio.run(
                send_signal_over_connection,
                access_token,
                sender_client_id,
                sender_connection_id,
                target_connection_id,
                {"description": signal_data},
            )

            messages = trio.run(
                subscription.wait_for_messages_async,
                1,
                lambda message: message["topic"] == target_webrtc_inbox_topic,
            )

        self.assertEqual(len(messages), 1)
        payload = messages[0]["payload"]
        self.assertEqual(payload["from_client_id"], sender_client_id)
        self.assertEqual(payload["type"], "description")
        self.assertEqual(payload["description"], signal_data)

    def test_mqtt_webrtc_inbox_message_is_delivered_over_websocket(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        sender_request_id = generate_random_string(24)
        signal_data = {
            "type": "answer",
            "sdp": "test-answer",
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)
        sender_status_topic = f"accounts/{account_id}/clients/{sender_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        async def run_flow():
            ready_event = trio.Event()
            send_channel, receive_channel = trio.open_memory_channel(1)
            async with trio.open_nursery() as nursery:
                nursery.start_soon(
                    receive_signal_over_connection,
                    access_token,
                    target_client_id,
                    target_connection_id,
                    ready_event,
                    send_channel,
                )
                await ready_event.wait()

                with MQTTPublisher() as publisher:
                    publisher.publish_json(sender_status_topic, {
                        "type": "connected",
                        "connection_id": sender_connection_id,
                        "request_id": sender_request_id,
                        "at_millis": int(time.time() * 1000),
                    })

                client.wait_for_matching_events(
                    access_token,
                    count=1,
                    predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == sender_connection_id,
                    from_cursor=0,
                )

                with MQTTPublisher() as publisher:
                    publisher.publish_json(target_webrtc_inbox_topic, {
                        "from_client_id": sender_client_id,
                        "type": "description",
                        "description": signal_data,
                    })

                message = await receive_channel.receive()
                nursery.cancel_scope.cancel()
                return message

        message = trio.run(run_flow)

        self.assertEqual(message["type"], "signal")
        self.assertEqual(message["signal"]["from_connection_id"], sender_connection_id)
        self.assertEqual(message["signal"]["data"]["description"], signal_data)


    def test_legacy_websocket_description_signal_is_published_as_mqtt_description(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        target_request_id = generate_random_string(24)
        offer = {
            "type": "offer",
            "sdp": "test-offer",
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        target_status_topic = f"accounts/{account_id}/clients/{target_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        with MQTTSubscription([target_webrtc_inbox_topic]) as subscription:
            with MQTTPublisher() as publisher:
                publisher.publish_json(target_status_topic, {
                    "type": "connected",
                    "connection_id": target_connection_id,
                    "request_id": target_request_id,
                    "at_millis": int(time.time() * 1000),
                })

            client.wait_for_matching_events(
                access_token,
                count=1,
                predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == target_connection_id,
                from_cursor=0,
            )

            trio.run(
                send_signal_over_connection,
                access_token,
                sender_client_id,
                sender_connection_id,
                target_connection_id,
                {"description": offer},
            )

            messages = trio.run(
                subscription.wait_for_messages_async,
                1,
                lambda message: message["topic"] == target_webrtc_inbox_topic,
            )

        self.assertEqual(len(messages), 1)
        payload = messages[0]["payload"]
        self.assertEqual(payload["from_client_id"], sender_client_id)
        self.assertEqual(payload["type"], "description")
        self.assertEqual(payload["description"], offer)

    def test_mqtt_description_signal_is_delivered_as_legacy_websocket_description(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        sender_request_id = generate_random_string(24)
        answer = {
            "type": "answer",
            "sdp": "test-answer",
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)
        sender_status_topic = f"accounts/{account_id}/clients/{sender_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        async def run_flow():
            ready_event = trio.Event()
            send_channel, receive_channel = trio.open_memory_channel(1)
            async with trio.open_nursery() as nursery:
                nursery.start_soon(
                    receive_signal_over_connection,
                    access_token,
                    target_client_id,
                    target_connection_id,
                    ready_event,
                    send_channel,
                )
                await ready_event.wait()

                with MQTTPublisher() as publisher:
                    publisher.publish_json(sender_status_topic, {
                        "type": "connected",
                        "connection_id": sender_connection_id,
                        "request_id": sender_request_id,
                        "at_millis": int(time.time() * 1000),
                    })

                client.wait_for_matching_events(
                    access_token,
                    count=1,
                    predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == sender_connection_id,
                    from_cursor=0,
                )

                with MQTTPublisher() as publisher:
                    publisher.publish_json(target_webrtc_inbox_topic, {
                        "from_client_id": sender_client_id,
                        "type": "description",
                        "description": answer,
                    })

                message = await receive_channel.receive()
                nursery.cancel_scope.cancel()
                return message

        message = trio.run(run_flow)

        self.assertEqual(message["type"], "signal")
        self.assertEqual(message["signal"]["from_connection_id"], sender_connection_id)
        self.assertIn("description", message["signal"]["data"])
        self.assertEqual(message["signal"]["data"]["description"], answer)


    def test_legacy_websocket_candidate_signal_is_published_as_mqtt_candidate(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        target_request_id = generate_random_string(24)
        candidate = {
            "candidate": "candidate:1",
            "sdpMid": "0",
            "sdpMLineIndex": 0,
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        target_status_topic = f"accounts/{account_id}/clients/{target_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        with MQTTSubscription([target_webrtc_inbox_topic]) as subscription:
            with MQTTPublisher() as publisher:
                publisher.publish_json(target_status_topic, {
                    "type": "connected",
                    "connection_id": target_connection_id,
                    "request_id": target_request_id,
                    "at_millis": int(time.time() * 1000),
                })

            client.wait_for_matching_events(
                access_token,
                count=1,
                predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == target_connection_id,
                from_cursor=0,
            )

            trio.run(
                send_signal_over_connection,
                access_token,
                sender_client_id,
                sender_connection_id,
                target_connection_id,
                {"candidate": candidate},
            )

            messages = trio.run(
                subscription.wait_for_messages_async,
                1,
                lambda message: message["topic"] == target_webrtc_inbox_topic,
            )

        self.assertEqual(len(messages), 1)
        payload = messages[0]["payload"]
        self.assertEqual(payload["from_client_id"], sender_client_id)
        self.assertEqual(payload["type"], "candidate")
        self.assertEqual(payload["candidate"], candidate)

    def test_mqtt_candidate_signal_is_delivered_as_legacy_websocket_candidate(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        target_client_id = generate_random_string(24)
        target_connection_id = generate_random_string(24)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        sender_request_id = generate_random_string(24)
        candidate = {
            "candidate": "candidate:1",
            "sdpMid": "0",
            "sdpMLineIndex": 0,
        }

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)
        sender_status_topic = f"accounts/{account_id}/clients/{sender_client_id}/status"
        target_webrtc_inbox_topic = f"accounts/{account_id}/clients/{target_client_id}/webrtc_inbox"

        async def run_flow():
            ready_event = trio.Event()
            send_channel, receive_channel = trio.open_memory_channel(1)
            async with trio.open_nursery() as nursery:
                nursery.start_soon(
                    receive_signal_over_connection,
                    access_token,
                    target_client_id,
                    target_connection_id,
                    ready_event,
                    send_channel,
                )
                await ready_event.wait()

                with MQTTPublisher() as publisher:
                    publisher.publish_json(sender_status_topic, {
                        "type": "connected",
                        "connection_id": sender_connection_id,
                        "request_id": sender_request_id,
                        "at_millis": int(time.time() * 1000),
                    })

                client.wait_for_matching_events(
                    access_token,
                    count=1,
                    predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == sender_connection_id,
                    from_cursor=0,
                )

                with MQTTPublisher() as publisher:
                    publisher.publish_json(target_webrtc_inbox_topic, {
                        "from_client_id": sender_client_id,
                        "type": "candidate",
                        "candidate": candidate,
                    })

                message = await receive_channel.receive()
                nursery.cancel_scope.cancel()
                return message

        message = trio.run(run_flow)

        self.assertEqual(message["type"], "signal")
        self.assertEqual(message["signal"]["from_connection_id"], sender_connection_id)
        self.assertIn("candidate", message["signal"]["data"])
        self.assertEqual(message["signal"]["data"]["candidate"], candidate)

    def test_legacy_backend_websocket_parent_receives_answer_from_mqtt_frontend_baby_station(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        baby_client_id = generate_random_string(24)
        parent_client_id = generate_random_string(24)
        parent_connection_id = generate_random_string(24)
        session_name = generate_random_string(10)

        client.create_account(email, password)
        access_token = client.login(email, password)

        baby_ready = threading.Event()
        release_baby = threading.Event()
        offer_queue = queue.Queue(maxsize=1)

        def run_baby_station():
            with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
                driver.get(app_base_url)
                driver.execute_script("localStorage.setItem('clientID', arguments[0]);", baby_client_id)
                driver.refresh()
                login(driver, email, password)
                driver.find_element(By.ID, "nav-link-baby").click()

                wait = WebDriverWait(driver, 10)
                wait.until(lambda driver: driver.find_element(By.ID, "button-continue-media-stream-permission-check")).click()
                session_name_input = wait.until(lambda driver: driver.find_element(By.ID, "input-session-name"))
                session_name_input.clear()
                session_name_input.send_keys(session_name)
                wait.until(lambda driver: driver.find_element(By.ID, "session-toggle")).click()
                wait_for_session_running(driver, timeout=10)

                offer = driver.execute_async_script("""
                    const done = arguments[arguments.length - 1];
                    (async () => {
                        const peerConnection = new RTCPeerConnection({ iceServers: [] });
                        peerConnection.addTransceiver("video", { direction: "recvonly" });
                        peerConnection.addTransceiver("audio", { direction: "recvonly" });
                        const offer = await peerConnection.createOffer();
                        await peerConnection.setLocalDescription(offer);
                        done({ type: peerConnection.localDescription.type, sdp: peerConnection.localDescription.sdp });
                    })().catch((error) => done({ error: String(error) }));
                """)
                if "error" in offer:
                    raise AssertionError(offer["error"])
                offer_queue.put(offer)
                baby_ready.set()
                if not release_baby.wait(timeout=30):
                    raise AssertionError("timed out waiting to release baby station browser")

        async def run_flow():
            query = urlencode({
                "access_token": access_token,
            })
            websocket_url = f"{api_websocket_base_url}/clients/{parent_client_id}/connections/{parent_connection_id}?{query}"

            async with trio.open_nursery() as nursery:
                nursery.start_soon(trio.to_thread.run_sync, run_baby_station)
                baby_started = await trio.to_thread.run_sync(baby_ready.wait, 20)
                if not baby_started:
                    raise AssertionError("timed out waiting for baby station browser")
                offer_signal_data = offer_queue.get(timeout=1)

                baby_connected_event = client.wait_for_event(
                    access_token,
                    predicate=lambda event: event["type"] == "client.connected" and event["data"]["client_id"] == baby_client_id,
                    from_cursor=0,
                    timeout_seconds=10,
                )
                baby_connection_id = baby_connected_event["data"]["connection_id"]

                async with open_websocket_url(websocket_url, ssl_context=websocket_ssl_context()) as websocket:
                    client.wait_for_event(
                        access_token,
                        predicate=lambda event: event["type"] == "client.connected" and event["data"]["connection_id"] == parent_connection_id,
                        from_cursor=0,
                        timeout_seconds=10,
                    )

                    await trio.sleep(0.6)
                    await websocket.send_message(json.dumps({
                        "type": "signal",
                        "signal": {
                            "to_connection_id": baby_connection_id,
                            "data": {
                                "description": offer_signal_data,
                            },
                        },
                    }))

                    websocket_message = None
                    with trio.move_on_after(10) as timeout_scope:
                        websocket_message = await websocket.get_message()
                    if timeout_scope.cancelled_caught:
                        release_baby.set()
                        nursery.cancel_scope.cancel()
                        raise AssertionError("timed out waiting for legacy websocket parent to receive MQTT baby station answer")
                    if isinstance(websocket_message, bytes):
                        websocket_message = websocket_message.decode("utf-8")

                release_baby.set()
                nursery.cancel_scope.cancel()
                return json.loads(websocket_message)

        try:
            message = trio.run(run_flow)
        finally:
            release_baby.set()

        self.assertEqual(message["type"], "signal")
        self.assertEqual(message["signal"]["data"]["description"]["type"], "answer")
        self.assertIn("sdp", message["signal"]["data"]["description"])


    def test_legacy_backend_websocket_baby_station_receives_offer_from_mqtt_frontend_parent(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        baby_client_id = generate_random_string(24)
        baby_connection_id = generate_random_string(24)
        parent_client_id = generate_random_string(24)
        session_id = generate_random_string(24)
        session_name = generate_random_string(10)
        started_at = utc_now_seconds_rfc3339()

        account = client.create_account(email, password)
        account_id = account["id"]
        access_token = client.login(email, password)

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": session_name,
            "host_connection_id": baby_connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)

        release_parent = threading.Event()

        def run_parent_station():
            baby_stations_topic = f"accounts/{account_id}/baby_stations"
            announcement_payload = {
                "type": "announcement",
                "at_millis": int(time.time() * 1000),
                "announcement": {
                    "client_id": baby_client_id,
                    "connection_id": baby_connection_id,
                    "session_id": session_id,
                    "name": session_name,
                    "started_at_millis": int(time.time() * 1000),
                },
            }

            with webdriver.Remote(command_executor=hub_url, options=chrome_options) as driver:
                driver.get(app_base_url)
                driver.execute_script("localStorage.setItem('clientID', arguments[0]);", parent_client_id)
                driver.refresh()
                login(driver, email, password)
                driver.find_element(By.ID, "nav-link-parent").click()

                end_time = time.monotonic() + 10
                with MQTTPublisher() as publisher:
                    while time.monotonic() < end_time:
                        publisher.publish_json(baby_stations_topic, announcement_payload)
                        dropdowns = driver.find_elements(By.ID, "baby-station-dropdown")
                        try:
                            if dropdowns and dropdowns[0].get_attribute("value") == session_id:
                                break
                        except StaleElementReferenceException:
                            pass
                        time.sleep(0.5)

                WebDriverWait(driver, 2).until(
                    lambda driver: driver.find_element(By.ID, "baby-station-dropdown").get_attribute("value") == session_id
                )
                if not release_parent.wait(timeout=30):
                    raise AssertionError("timed out waiting to release parent station browser")

        async def run_flow():
            ready_event = trio.Event()
            send_channel, receive_channel = trio.open_memory_channel(1)
            async with trio.open_nursery() as nursery:
                nursery.start_soon(
                    receive_signal_over_connection,
                    access_token,
                    baby_client_id,
                    baby_connection_id,
                    ready_event,
                    send_channel,
                )
                await ready_event.wait()

                client.wait_for_matching_events(
                    access_token,
                    count=2,
                    predicate=lambda event: event["type"] in {"client.connected", "session.started"},
                    from_cursor=0,
                    timeout_seconds=10,
                )

                nursery.start_soon(trio.to_thread.run_sync, run_parent_station)
                message = None
                with trio.move_on_after(10) as timeout_scope:
                    message = await receive_channel.receive()
                if timeout_scope.cancelled_caught:
                    release_parent.set()
                    nursery.cancel_scope.cancel()
                    raise AssertionError("timed out waiting for legacy websocket baby station to receive MQTT parent station offer")

                release_parent.set()
                nursery.cancel_scope.cancel()
                return message

        try:
            message = trio.run(run_flow)
        finally:
            release_parent.set()

        self.assertEqual(message["type"], "signal")
        self.assertIn("description", message["signal"]["data"])
        self.assertEqual(message["signal"]["data"]["description"]["type"], "offer")
        self.assertIn("sdp", message["signal"]["data"]["description"])
