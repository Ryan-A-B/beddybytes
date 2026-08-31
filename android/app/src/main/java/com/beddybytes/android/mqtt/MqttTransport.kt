package com.beddybytes.android.mqtt

internal data class MqttConnectRequest(
    val host: String,
    val clientId: String,
    val accessToken: String,
    val willTopic: String,
    val willPayload: String,
)

internal data class MqttInboundMessage(val topic: String, val payload: String)

internal fun interface MqttTransport {
    suspend fun connect(
        request: MqttConnectRequest,
        onDisconnected: (Throwable) -> Unit,
    ): MqttConnection
}

internal interface MqttConnection {
    suspend fun subscribe(topicFilter: String, onMessage: (MqttInboundMessage) -> Unit)

    suspend fun publish(topic: String, payload: String)

    suspend fun disconnect()
}
