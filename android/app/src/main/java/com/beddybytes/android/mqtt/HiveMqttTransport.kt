package com.beddybytes.android.mqtt

import com.hivemq.client.mqtt.MqttWebSocketConfig
import com.hivemq.client.mqtt.datatypes.MqttQos
import com.hivemq.client.mqtt.mqtt3.Mqtt3AsyncClient
import com.hivemq.client.mqtt.mqtt3.Mqtt3Client
import com.hivemq.client.mqtt.mqtt3.message.connect.Mqtt3Connect
import com.hivemq.client.mqtt.mqtt3.message.publish.Mqtt3Publish
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.util.concurrent.CompletableFuture
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

internal class HiveMqttTransport : MqttTransport {
    override suspend fun connect(
        request: MqttConnectRequest,
        onDisconnected: (Throwable) -> Unit,
    ): MqttConnection {
        val connected = AtomicBoolean(false)
        val closing = AtomicBoolean(false)
        val webSocketConfig =
            MqttWebSocketConfig.builder()
                .serverPath(AWS_IOT_WEB_SOCKET_PATH)
                .queryString(accessTokenQuery(request.accessToken))
                .build()
        val client =
            Mqtt3Client.builder()
                .identifier(request.clientId)
                .serverHost(request.host)
                .serverPort(AWS_IOT_WEB_SOCKET_PORT)
                .sslWithDefaultConfig()
                .webSocketConfig(webSocketConfig)
                .addConnectedListener { connected.set(true) }
                .addDisconnectedListener { context ->
                    if (connected.get() && !closing.get()) {
                        onDisconnected(context.cause)
                    }
                }.buildAsync()
        val will = publishMessage(request.willTopic, request.willPayload)
        val connectMessage =
            Mqtt3Connect.builder()
                .keepAlive(AWS_IOT_MINIMUM_KEEP_ALIVE_SECONDS)
                .cleanSession(true)
                .willPublish(will)
                .build()
        client.connect(connectMessage).await()
        return HiveMqttConnection(client, closing)
    }

    private class HiveMqttConnection(
        private val client: Mqtt3AsyncClient,
        private val closing: AtomicBoolean,
    ) : MqttConnection {
        override suspend fun subscribe(
            topicFilter: String,
            onMessage: (MqttInboundMessage) -> Unit,
        ) {
            client.subscribeWith()
                .topicFilter(topicFilter)
                .qos(MqttQos.AT_LEAST_ONCE)
                .callback { message ->
                    onMessage(
                        MqttInboundMessage(
                            topic = message.topic.toString(),
                            payload = message.payloadAsBytes.toString(StandardCharsets.UTF_8),
                        ),
                    )
                }.send()
                .await()
        }

        override suspend fun publish(topic: String, payload: String) {
            client.publish(publishMessage(topic, payload)).await()
        }

        override suspend fun disconnect() {
            closing.set(true)
            client.disconnect().await()
        }
    }

    private companion object {
        const val AWS_IOT_WEB_SOCKET_PORT = 443
        const val AWS_IOT_WEB_SOCKET_PATH = "mqtt"
        const val AWS_IOT_MINIMUM_KEEP_ALIVE_SECONDS = 30
    }
}

private fun publishMessage(topic: String, payload: String): Mqtt3Publish = Mqtt3Publish.builder()
    .topic(topic)
    .payload(payload.toByteArray(StandardCharsets.UTF_8))
    .qos(MqttQos.AT_LEAST_ONCE)
    .retain(false)
    .build()

internal fun accessTokenQuery(accessToken: String): String =
    "access_token=" + URLEncoder.encode(accessToken, StandardCharsets.UTF_8.name())

private suspend fun <T> CompletableFuture<T>.await(): T =
    suspendCancellableCoroutine { continuation ->
        whenComplete { value, error ->
            if (error == null) {
                continuation.resume(value)
            } else {
                continuation.resumeWithException(error.cause ?: error)
            }
        }
        continuation.invokeOnCancellation { cancel(true) }
    }
