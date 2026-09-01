package com.beddybytes.android.mqtt

import android.graphics.Bitmap
import android.media.Image
import com.beddybytes.android.webrtc.BabyStationWebRtcController
import com.beddybytes.android.webrtc.WebRtcDescription
import com.beddybytes.android.webrtc.WebRtcEventLogger
import com.beddybytes.android.webrtc.WebRtcInboundSignal
import com.beddybytes.android.webrtc.WebRtcOutboundSignal
import com.beddybytes.android.webrtc.WebRtcStartRequest
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BabyStationMqttSessionTest {
    @Test
    fun `routes web rtc signalling between mqtt and the media controller`() = runTest {
        val transport = FakeTransport()
        val webRtc = FakeWebRtcController()
        val session =
            BabyStationMqttSession(
                mqttHost = "mqtt.qa.beddybytes.com",
                credentialsProvider = MqttCredentialsProvider {
                    MqttCredentials("account-1", "token")
                },
                clientIdStore = MqttClientIdStore { "baby-client" },
                transport = transport,
                scope = this,
                webRtcController = webRtc,
                newId = { "id" },
            )

        session.start(BabyStationStartRequest("Nursery", "camera-0", 42))
        runCurrent()
        assertEquals(WebRtcStartRequest("baby-client", 42), webRtc.startRequest)
        val connection = transport.connections.single()
        connection.dispatch(
            MqttTopics.webRtcInbox("account-1", "baby-client"),
            """{"from_client_id":"parent-client","type":"description","description":{"type":"offer","sdp":"v=0"}}""",
        )
        runCurrent()
        assertEquals(1, webRtc.inbound.size)

        webRtc.sendSignal(
            WebRtcOutboundSignal.Answer(
                "parent-client",
                WebRtcDescription("answer", "v=0-answer"),
            ),
        )
        runCurrent()
        val published = connection.publishes.last()
        assertEquals(
            MqttTopics.webRtcInbox("account-1", "parent-client"),
            published.first,
        )
        assertEquals("description", payloadType(published.second))

        session.stop()
        runCurrent()
        assertTrue(webRtc.stopped)
    }

    @Test
    fun `stop cancels an in progress connection`() = runTest {
        val session =
            BabyStationMqttSession(
                mqttHost = "mqtt.qa.beddybytes.com",
                credentialsProvider = MqttCredentialsProvider {
                    MqttCredentials("account-1", "token")
                },
                clientIdStore = MqttClientIdStore { "baby-client" },
                transport = MqttTransport { _, _ -> awaitCancellation() },
                scope = this,
                newId = { "id" },
            )

        session.start(BabyStationStartRequest("Nursery", "0", 1))
        runCurrent()
        assertEquals(BabyStationSessionState.Connecting, session.state.value)

        session.stop()
        runCurrent()

        assertEquals(BabyStationSessionState.Ready, session.state.value)
    }

    @Test
    fun `connects announces responds reconnects with fresh credentials and stops cleanly`() =
        runTest {
            val credentials = FakeCredentialsProvider()
            val transport = FakeTransport()
            val ids =
                ArrayDeque(
                    listOf("session-1", "connection-1", "request-1", "connection-2", "request-2"),
                )
            var now = 123L
            val eventLog = RecordingSessionEventLog()
            val session =
                BabyStationMqttSession(
                    mqttHost = "mqtt.qa.beddybytes.com",
                    credentialsProvider = credentials,
                    clientIdStore = MqttClientIdStore { "baby-client" },
                    transport = transport,
                    scope = this,
                    eventLogFactory = SessionEventLogFactory { eventLog },
                    nowMillis = { now },
                    newId = ids::removeFirst,
                )

            session.start(BabyStationStartRequest(" Nursery ", "0", 1))
            runCurrent()

            assertTrue(session.state.value is BabyStationSessionState.Active)
            val first = transport.connections.single()
            assertEquals("token-1", transport.requests.single().accessToken)
            assertEquals("mqtt.qa.beddybytes.com", transport.requests.single().host)
            assertEquals("accounts/account-1/clients/baby-client/status", first.publishes[0].first)
            assertEquals("connected", payloadType(first.publishes[0].second))
            assertEquals(
                listOf(
                    "accounts/account-1/parent_stations",
                    "accounts/account-1/clients/baby-client/webrtc_inbox",
                ),
                first.subscriptions.keys.toList(),
            )
            assertEquals("accounts/account-1/baby_stations", first.publishes[1].first)
            assertEquals("Nursery", announcementName(first.publishes[1].second))

            now = 456
            first.dispatch(
                topic = "accounts/account-1/parent_stations",
                payload =
                    """{"type":"announcement","at_millis":456,"announcement":{"client_id":"parent-client","connection_id":"parent-connection"}}""",
            )
            runCurrent()
            assertEquals(
                "accounts/account-1/clients/parent-client/control_inbox",
                first.publishes[2].first,
            )
            assertEquals("baby_station_announcement", payloadType(first.publishes[2].second))

            first.drop()
            runCurrent()
            assertEquals(BabyStationSessionState.Reconnecting, session.state.value)
            advanceTimeBy(1_000)
            runCurrent()

            assertEquals(2, transport.connections.size)
            assertEquals("token-2", transport.requests[1].accessToken)
            assertNotEquals(transport.requests[0].willPayload, transport.requests[1].willPayload)
            val second = transport.connections[1]
            assertEquals("session-1", announcementSessionId(second.publishes[1].second))
            assertEquals("connection-2", announcementConnectionId(second.publishes[1].second))

            session.stop()
            runCurrent()

            assertEquals(BabyStationSessionState.Ready, session.state.value)
            assertEquals("disconnected", payloadType(second.publishes.last().second))
            assertEquals("clean", disconnectReason(second.publishes.last().second))
            assertTrue(second.disconnected)
            assertTrue(
                eventLog.events.map { it.event }.containsAll(
                    listOf(
                        "session_started",
                        "mqtt_connect_started",
                        "mqtt_connected",
                        "mqtt_subscribed",
                        "mqtt_message",
                        "session_active",
                        "mqtt_connection_lost",
                        "mqtt_reconnect_scheduled",
                        "session_stop_requested",
                        "mqtt_disconnected",
                        "session_stopped",
                    ),
                ),
            )
            assertTrue(eventLog.events.none { event -> event.fields.values.any { "token" in it } })
            assertTrue(eventLog.closed)
        }

    private fun payloadType(payload: String): String =
        Json.parseToJsonElement(payload).jsonObject.getValue("type").jsonPrimitive.content

    private fun announcementName(payload: String): String =
        Json.parseToJsonElement(payload).jsonObject
            .getValue("announcement").jsonObject
            .getValue("name").jsonPrimitive.content

    private fun announcementSessionId(payload: String): String =
        Json.parseToJsonElement(payload).jsonObject
            .getValue("announcement").jsonObject
            .getValue("session_id").jsonPrimitive.content

    private fun announcementConnectionId(payload: String): String =
        Json.parseToJsonElement(payload).jsonObject
            .getValue("announcement").jsonObject
            .getValue("connection_id").jsonPrimitive.content

    private fun disconnectReason(payload: String): String =
        Json.parseToJsonElement(payload).jsonObject
            .getValue("disconnected").jsonObject
            .getValue("reason").jsonPrimitive.content

    private class FakeCredentialsProvider : MqttCredentialsProvider {
        private var count = 0

        override suspend fun credentials(): MqttCredentials {
            count++
            return MqttCredentials("account-1", "token-$count")
        }
    }

    private class FakeTransport : MqttTransport {
        val requests = mutableListOf<MqttConnectRequest>()
        val connections = mutableListOf<FakeConnection>()

        override suspend fun connect(
            request: MqttConnectRequest,
            onDisconnected: (Throwable) -> Unit,
        ): MqttConnection {
            requests += request
            return FakeConnection(onDisconnected).also(connections::add)
        }
    }

    private class FakeConnection(private val onDisconnected: (Throwable) -> Unit) :
        MqttConnection {
        val subscriptions = linkedMapOf<String, (MqttInboundMessage) -> Unit>()
        val publishes = mutableListOf<Pair<String, String>>()
        var disconnected = false

        override suspend fun subscribe(
            topicFilter: String,
            onMessage: (MqttInboundMessage) -> Unit,
        ) {
            subscriptions[topicFilter] = onMessage
        }

        override suspend fun publish(topic: String, payload: String) {
            publishes += topic to payload
        }

        override suspend fun disconnect() {
            disconnected = true
        }

        fun dispatch(topic: String, payload: String) {
            subscriptions.getValue(topic)(MqttInboundMessage(topic, payload))
        }

        fun drop() {
            onDisconnected(IllegalStateException("network lost"))
        }
    }

    private class RecordingSessionEventLog : SessionEventLog {
        val events = mutableListOf<RecordedEvent>()
        var closed = false

        override fun record(atMillis: Long, event: String, fields: Map<String, String>) {
            events += RecordedEvent(event, fields)
        }

        override fun close() {
            closed = true
        }
    }

    private data class RecordedEvent(val event: String, val fields: Map<String, String>)

    private class FakeWebRtcController : BabyStationWebRtcController {
        var startRequest: WebRtcStartRequest? = null
        lateinit var sendSignal: (WebRtcOutboundSignal) -> Unit
        val inbound = mutableListOf<WebRtcInboundSignal>()
        var stopped = false

        override suspend fun start(
            request: WebRtcStartRequest,
            sendSignal: (WebRtcOutboundSignal) -> Unit,
            eventLogger: WebRtcEventLogger,
        ) {
            startRequest = request
            this.sendSignal = sendSignal
        }

        override fun handle(signal: WebRtcInboundSignal) {
            inbound += signal
        }

        override fun onCameraFrame(image: Image, rotationDegrees: Int) = Unit

        override fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long) = Unit

        override suspend fun stop() {
            stopped = true
        }
    }
}
