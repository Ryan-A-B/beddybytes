package com.beddybytes.android.mqtt

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

internal object MqttTopics {
    fun clientStatus(accountId: String, clientId: String): String =
        "accounts/${segment(accountId)}/clients/${segment(clientId)}/status"

    fun webRtcInbox(accountId: String, clientId: String): String =
        "accounts/${segment(accountId)}/clients/${segment(clientId)}/webrtc_inbox"

    fun controlInbox(accountId: String, clientId: String): String =
        "accounts/${segment(accountId)}/clients/${segment(clientId)}/control_inbox"

    fun babyStations(accountId: String): String = "accounts/${segment(accountId)}/baby_stations"

    fun parentStations(accountId: String): String = "accounts/${segment(accountId)}/parent_stations"

    private fun segment(value: String): String {
        require(value.isNotBlank())
        require(value.none { it == '/' || it == '+' || it == '#' || it.code == 0 })
        return value
    }
}

@Serializable
internal data class ClientStatusPayload(
    val type: String,
    @SerialName("connection_id") val connectionId: String,
    @SerialName("request_id") val requestId: String,
    @SerialName("at_millis") val atMillis: Long,
    val disconnected: DisconnectedDetails? = null,
)

@Serializable
internal data class DisconnectedDetails(val reason: String)

@Serializable
internal data class SessionAnnouncement(
    @SerialName("client_id") val clientId: String,
    @SerialName("connection_id") val connectionId: String,
    @SerialName("session_id") val sessionId: String,
    val name: String,
    @SerialName("started_at_millis") val startedAtMillis: Long,
)

@Serializable
internal data class BabyStationAnnouncementPayload(
    val type: String = "announcement",
    @SerialName("at_millis") val atMillis: Long,
    val announcement: SessionAnnouncement,
)

@Serializable
internal data class BabyStationControlPayload(
    val type: String = "baby_station_announcement",
    @SerialName("at_millis") val atMillis: Long,
    @SerialName("baby_station_announcement") val babyStationAnnouncement: SessionAnnouncement,
)

@Serializable
internal data class ParentStationAnnouncementPayload(
    val type: String,
    val announcement: ParentStationAnnouncement,
)

@Serializable
internal data class ParentStationAnnouncement(
    @SerialName("client_id") val clientId: String,
    @SerialName("connection_id") val connectionId: String,
)

internal object MqttPayloads {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }

    fun connected(connectionId: String, requestId: String, atMillis: Long): String =
        json.encodeToString(
            ClientStatusPayload(
                type = "connected",
                connectionId = connectionId,
                requestId = requestId,
                atMillis = atMillis,
            ),
        )

    fun disconnected(
        connectionId: String,
        requestId: String,
        atMillis: Long,
        reason: String,
    ): String = json.encodeToString(
        ClientStatusPayload(
            type = "disconnected",
            connectionId = connectionId,
            requestId = requestId,
            atMillis = atMillis,
            disconnected = DisconnectedDetails(reason),
        ),
    )

    fun babyStation(announcement: SessionAnnouncement): String = json.encodeToString(
        BabyStationAnnouncementPayload(
            atMillis = announcement.startedAtMillis,
            announcement = announcement,
        ),
    )

    fun babyStationControl(announcement: SessionAnnouncement, atMillis: Long): String =
        json.encodeToString(
            BabyStationControlPayload(
                atMillis = atMillis,
                babyStationAnnouncement = announcement,
            ),
        )

    fun parentStation(message: MqttInboundMessage, accountId: String): ParentStationAnnouncement? {
        if (message.topic != MqttTopics.parentStations(accountId)) return null
        val payload = runCatching {
            json.decodeFromString<ParentStationAnnouncementPayload>(message.payload)
        }.getOrNull() ?: return null
        if (payload.type != "announcement") return null
        return payload.announcement.takeIf { announcement ->
            runCatching {
                MqttTopics.controlInbox(accountId, announcement.clientId)
            }.isSuccess
        }
    }
}
