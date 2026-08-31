package com.beddybytes.android.mqtt

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MqttProtocolTest {
    @Test
    fun `topics match the browser account scope`() {
        assertEquals(
            "accounts/account-1/clients/client-1/status",
            MqttTopics.clientStatus("account-1", "client-1"),
        )
        assertEquals(
            "accounts/account-1/clients/client-1/webrtc_inbox",
            MqttTopics.webRtcInbox("account-1", "client-1"),
        )
        assertEquals("accounts/account-1/baby_stations", MqttTopics.babyStations("account-1"))
        assertEquals("accounts/account-1/parent_stations", MqttTopics.parentStations("account-1"))
    }

    @Test
    fun `web socket access token query is safely encoded`() {
        assertEquals("access_token=header.payload%2B%2F%3D", accessTokenQuery("header.payload+/="))
    }

    @Test
    fun `connected and unexpected will payloads match browser fixtures`() {
        assertEquals(
            Json.parseToJsonElement(
                """{"type":"connected","connection_id":"connection-1","request_id":"request-1","at_millis":123}""",
            ),
            Json.parseToJsonElement(MqttPayloads.connected("connection-1", "request-1", 123)),
        )
        assertEquals(
            Json.parseToJsonElement(
                """{"type":"disconnected","connection_id":"connection-1","request_id":"request-1","at_millis":0,"disconnected":{"reason":"unexpected"}}""",
            ),
            Json.parseToJsonElement(
                MqttPayloads.disconnected("connection-1", "request-1", 0, "unexpected"),
            ),
        )
    }

    @Test
    fun `station announcements match browser fixtures`() {
        val announcement =
            SessionAnnouncement(
                clientId = "baby-client",
                connectionId = "connection-1",
                sessionId = "session-1",
                name = "Nursery",
                startedAtMillis = 123,
            )
        val global = Json.parseToJsonElement(MqttPayloads.babyStation(announcement)).jsonObject
        val control =
            Json.parseToJsonElement(
                MqttPayloads.babyStationControl(announcement, 456),
            ).jsonObject

        assertEquals("announcement", global.getValue("type").jsonPrimitive.content)
        assertEquals("123", global.getValue("at_millis").jsonPrimitive.content)
        assertEquals(announcementJson(), global.getValue("announcement"))
        assertEquals("baby_station_announcement", control.getValue("type").jsonPrimitive.content)
        assertEquals("456", control.getValue("at_millis").jsonPrimitive.content)
        assertEquals(announcementJson(), control.getValue("baby_station_announcement"))
    }

    @Test
    fun `parent announcements ignore unknown fields and reject wrong topics or unsafe clients`() {
        val payload =
            """{"type":"announcement","unknown":true,"announcement":{"client_id":"parent-client","connection_id":"parent-connection","future":"value"}}"""

        assertEquals(
            ParentStationAnnouncement("parent-client", "parent-connection"),
            MqttPayloads.parentStation(
                MqttInboundMessage("accounts/account-1/parent_stations", payload),
                "account-1",
            ),
        )
        assertNull(
            MqttPayloads.parentStation(
                MqttInboundMessage("accounts/other/parent_stations", payload),
                "account-1",
            ),
        )
        assertNull(
            MqttPayloads.parentStation(
                MqttInboundMessage(
                    "accounts/account-1/parent_stations",
                    payload.replace("parent-client", "parent/+/client"),
                ),
                "account-1",
            ),
        )
    }

    private fun announcementJson() = Json.parseToJsonElement(
        """{"client_id":"baby-client","connection_id":"connection-1","session_id":"session-1","name":"Nursery","started_at_millis":123}""",
    )
}
