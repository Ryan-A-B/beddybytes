import unittest

import trio

from backend_api_utils import BackendAPIClient, open_connection_websocket, open_connection_websocket_until_signaled, send_signal_between_connections, send_signal_to_missing_connection_and_expect_pong, spawn_connection_websocket_process, utc_now_seconds_rfc3339
from utils import generate_random_string


class TestBackendHTTPAPI(unittest.TestCase):
    def test_start_session_writes_session_started_event_after_connection_websocket_opens(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        client.create_account(email, password)
        access_token = client.login(email, password)

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": "Nursery",
            "host_connection_id": connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)

        async def run_test():
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

                events = client.wait_for_matching_events(
                    access_token,
                    count=2,
                    predicate=lambda event: event["type"] in {"session.started", "client.connected"},
                    from_cursor=0,
                )

                self.assertEqual(len(events), 2)

                event_by_type = {
                    event["type"]: event
                    for event in events
                }
                self.assertEqual(set(event_by_type.keys()), {"session.started", "client.connected"})

                session_started_event = event_by_type["session.started"]
                self.assertEqual(session_started_event["data"]["id"], session_id)
                self.assertEqual(session_started_event["data"]["name"], "Nursery")
                self.assertEqual(session_started_event["data"]["host_connection_id"], connection_id)
                self.assertEqual(session_started_event["data"]["started_at"], started_at)

                connected_event = event_by_type["client.connected"]
                self.assertEqual(connected_event["data"]["client_id"], client_id)
                self.assertEqual(connected_event["data"]["connection_id"], connection_id)
                self.assertIn("request_id", connected_event["data"])
                self.assertTrue(connected_event["data"]["request_id"])

                session_list = client.list_sessions(access_token)
                self.assertEqual(len(session_list["sessions"]), 1)
                self.assertEqual(session_list["sessions"][0]["id"], session_id)
                self.assertEqual(session_list["sessions"][0]["name"], "Nursery")
                self.assertEqual(session_list["sessions"][0]["host_connection_id"], connection_id)

                release_event.set()

        trio.run(run_test)

    def test_end_session_writes_session_ended_event(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        client.create_account(email, password)
        access_token = client.login(email, password)

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": "Nursery",
            "host_connection_id": connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)

        trio.run(open_connection_websocket, access_token, client_id, connection_id)

        setup_events = client.wait_for_matching_events(
            access_token,
            count=2,
            predicate=lambda event: event["type"] in {"session.started", "client.connected"},
            from_cursor=0,
        )
        setup_cursor = max(event["logical_clock"] for event in setup_events)

        response = client.end_session(access_token, session_id)
        self.assertEqual(response.status_code, 200, response.text)

        events = client.wait_for_matching_events(
            access_token,
            count=1,
            predicate=lambda event: event["type"] == "session.ended",
            from_cursor=setup_cursor,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "session.ended")
        self.assertEqual(events[0]["data"]["id"], session_id)

        session_list = client.list_sessions(access_token)
        self.assertEqual(len(session_list["sessions"]), 0)

    def test_clean_websocket_disconnect_writes_client_disconnected_event_and_removes_session_from_session_list(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        client.create_account(email, password)
        access_token = client.login(email, password)

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": "Nursery",
            "host_connection_id": connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)

        trio.run(open_connection_websocket, access_token, client_id, connection_id)

        setup_events = client.wait_for_matching_events(
            access_token,
            count=2,
            predicate=lambda event: event["type"] in {"session.started", "client.connected"},
            from_cursor=0,
        )
        setup_cursor = max(event["logical_clock"] for event in setup_events)

        events = client.wait_for_matching_events(
            access_token,
            count=1,
            predicate=lambda event: event["type"] == "client.disconnected",
            from_cursor=setup_cursor,
        )

        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["type"], "client.disconnected")
        self.assertEqual(events[0]["data"]["client_id"], client_id)
        self.assertEqual(events[0]["data"]["connection_id"], connection_id)
        self.assertIn("request_id", events[0]["data"])
        self.assertTrue(events[0]["data"]["request_id"])

        session_list = client.list_sessions(access_token)
        self.assertEqual(len(session_list["sessions"]), 0)

    def test_unclean_websocket_disconnect_writes_client_disconnected_event_and_removes_session_from_session_list(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        client_id = generate_random_string(24)
        connection_id = generate_random_string(24)
        session_id = generate_random_string(24)
        started_at = utc_now_seconds_rfc3339()

        client.create_account(email, password)
        access_token = client.login(email, password)

        response = client.start_session(access_token, session_id, {
            "id": session_id,
            "name": "Nursery",
            "host_connection_id": connection_id,
            "started_at": started_at,
        })
        self.assertEqual(response.status_code, 200, response.text)
        websocket_process = spawn_connection_websocket_process(access_token, client_id, connection_id)
        try:
            setup_events = client.wait_for_matching_events(
                access_token,
                count=2,
                predicate=lambda event: event["type"] in {"session.started", "client.connected"},
                from_cursor=0,
                timeout_seconds=10,
            )
            setup_cursor = max(event["logical_clock"] for event in setup_events)
            connected_event = next(event for event in setup_events if event["type"] == "client.connected")

            websocket_process.kill()
            websocket_process.wait(timeout=5)

            events = client.wait_for_matching_events(
                access_token,
                count=1,
                predicate=lambda event: event["type"] == "client.disconnected",
                from_cursor=setup_cursor,
                timeout_seconds=10,
            )

            self.assertEqual(len(events), 1)
            disconnected_event = events[0]
            self.assertEqual(disconnected_event["type"], "client.disconnected")
            self.assertEqual(disconnected_event["data"]["client_id"], client_id)
            self.assertEqual(disconnected_event["data"]["connection_id"], connection_id)
            self.assertEqual(disconnected_event["data"]["request_id"], connected_event["data"]["request_id"])

            session_list = client.list_sessions(access_token)
            self.assertEqual(len(session_list["sessions"]), 0)
        finally:
            if websocket_process.poll() is None:
                websocket_process.kill()
                websocket_process.wait(timeout=5)

    def test_websocket_signal_sent_to_client_gets_delivered_to_that_client(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        recipient_client_id = generate_random_string(24)
        recipient_connection_id = generate_random_string(24)
        signal_data = {
            "type": "offer",
            "sdp": "test-offer",
        }

        client.create_account(email, password)
        access_token = client.login(email, password)

        message = trio.run(
            send_signal_between_connections,
            access_token,
            sender_client_id,
            sender_connection_id,
            recipient_client_id,
            recipient_connection_id,
            signal_data,
        )

        self.assertEqual(message["type"], "signal")
        self.assertEqual(message["signal"]["from_connection_id"], sender_connection_id)
        self.assertEqual(message["signal"]["data"], signal_data)

    def test_websocket_signal_to_missing_connection_does_not_close_sender_connection(self):
        client = BackendAPIClient()
        email = f"{generate_random_string(10)}@integrationtests.com"
        password = generate_random_string(20)
        sender_client_id = generate_random_string(24)
        sender_connection_id = generate_random_string(24)
        missing_connection_id = generate_random_string(24)
        signal_data = {
            "candidate": "test-candidate",
        }

        client.create_account(email, password)
        access_token = client.login(email, password)

        message = trio.run(
            send_signal_to_missing_connection_and_expect_pong,
            access_token,
            sender_client_id,
            sender_connection_id,
            missing_connection_id,
            signal_data,
        )

        self.assertEqual(message["type"], "pong")
