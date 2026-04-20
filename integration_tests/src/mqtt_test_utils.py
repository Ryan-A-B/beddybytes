import json
import queue
import ssl
import threading

import paho.mqtt.client as mqtt
import trio


class MQTTSubscription:
    def __init__(self, topics):
        self.topics = topics
        self.messages = queue.Queue()
        self.connected = threading.Event()
        self.subscribed = threading.Event()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, transport="websockets")
        self.client.tls_set(cert_reqs=ssl.CERT_NONE)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self._on_connect
        self.client.on_subscribe = self._on_subscribe
        self.client.on_message = self._on_message

    def __enter__(self):
        self.client.connect("mosquitto.beddybytes.local", 443, 60)
        self.client.loop_start()
        if not self.connected.wait(timeout=5):
            raise AssertionError("timed out waiting for MQTT connection")
        if not self.subscribed.wait(timeout=5):
            raise AssertionError("timed out waiting for MQTT subscription")
        return self

    def __exit__(self, exc_type, exc, tb):
        self.client.loop_stop()
        self.client.disconnect()

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        for topic in self.topics:
            client.subscribe(topic, qos=1)
        self.connected.set()

    def _on_subscribe(self, client, userdata, mid, reason_code_list, properties):
        self.subscribed.set()

    def _on_message(self, client, userdata, message):
        self.messages.put({
            "topic": message.topic,
            "payload": json.loads(message.payload.decode("utf-8")),
        })

    def wait_for_messages(self, count, predicate=None, timeout=5):
        messages = []
        while len(messages) < count:
            try:
                message = self.messages.get(timeout=timeout)
            except queue.Empty as exc:
                raise AssertionError(
                    f"timed out waiting for {count} MQTT messages after receiving {len(messages)}"
                ) from exc
            if predicate is not None and not predicate(message):
                continue
            messages.append(message)
        return messages

    async def wait_for_messages_async(self, count, predicate=None, timeout=5):
        return await trio.to_thread.run_sync(
            self.wait_for_messages,
            count,
            predicate,
            timeout,
        )


class MQTTPublisher:
    def __init__(self):
        self.connected = threading.Event()
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, transport="websockets")
        self.client.tls_set(cert_reqs=ssl.CERT_NONE)
        self.client.tls_insecure_set(True)
        self.client.on_connect = self._on_connect

    def __enter__(self):
        self.client.connect("mosquitto.beddybytes.local", 443, 60)
        self.client.loop_start()
        if not self.connected.wait(timeout=5):
            raise AssertionError("timed out waiting for MQTT connection")
        return self

    def __exit__(self, exc_type, exc, tb):
        self.client.loop_stop()
        self.client.disconnect()

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        self.connected.set()

    def publish_json(self, topic, payload, qos=1):
        result = self.client.publish(topic, json.dumps(payload), qos=qos)
        result.wait_for_publish()
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            raise AssertionError(f"failed to publish to {topic}: rc={result.rc}")
