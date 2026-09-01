package com.beddybytes.android.mqtt

import com.beddybytes.android.authorization.AuthenticationRequiredException
import java.util.UUID
import kotlin.math.min
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.selects.select
import kotlinx.coroutines.withTimeoutOrNull

sealed interface BabyStationSessionState {
    data object Ready : BabyStationSessionState

    data object Connecting : BabyStationSessionState

    data class Active(val sessionId: String, val connectionId: String) : BabyStationSessionState

    data object Reconnecting : BabyStationSessionState

    data object Stopping : BabyStationSessionState

    data class Failed(val message: String) : BabyStationSessionState
}

interface BabyStationSessionController {
    val state: StateFlow<BabyStationSessionState>

    fun start(name: String)

    fun stop()
}

internal class BabyStationMqttSession(
    private val mqttHost: String,
    private val credentialsProvider: MqttCredentialsProvider,
    private val clientIdStore: MqttClientIdStore,
    private val transport: MqttTransport,
    private val scope: CoroutineScope,
    private val eventLogFactory: SessionEventLogFactory = NoOpSessionEventLogFactory,
    private val nowMillis: () -> Long = System::currentTimeMillis,
    private val newId: () -> String = { UUID.randomUUID().toString() },
) : BabyStationSessionController {
    private val mutableState =
        MutableStateFlow<BabyStationSessionState>(BabyStationSessionState.Ready)
    private val mutableWebRtcSignals =
        MutableSharedFlow<MqttInboundMessage>(extraBufferCapacity = 64)
    private var runtime: SessionRuntime? = null

    override val state: StateFlow<BabyStationSessionState> = mutableState.asStateFlow()
    val webRtcSignals: SharedFlow<MqttInboundMessage> = mutableWebRtcSignals.asSharedFlow()

    override fun start(name: String) {
        val stationName = name.trim()
        if (stationName.isEmpty()) return
        val startedRuntime = synchronized(this) {
            if (runtime != null) return
            SessionRuntime(
                name = stationName,
                sessionId = newId(),
                startedAtMillis = nowMillis(),
            ).also { runtime = it }
        }
        mutableState.value = BabyStationSessionState.Connecting
        scope.launch { runSession(startedRuntime) }
    }

    override fun stop() {
        val activeRuntime = synchronized(this) { runtime }
        if (activeRuntime == null) {
            if (mutableState.value is BabyStationSessionState.Failed) {
                mutableState.value = BabyStationSessionState.Ready
            }
            return
        }
        mutableState.value = BabyStationSessionState.Stopping
        synchronized(activeRuntime) {
            if (!activeRuntime.stop.isCompleted) {
                activeRuntime.stopRequestedAtMillis = nowMillis()
                activeRuntime.stop.complete(Unit)
            }
        }
    }

    private suspend fun runSession(activeRuntime: SessionRuntime) {
        var attempt = 0
        var failed = false
        var completionReason = "stopped"
        activeRuntime.eventLog =
            runCatching {
                eventLogFactory.create(
                    SessionLogContext(
                        sessionId = activeRuntime.sessionId,
                        stationName = activeRuntime.name,
                        startedAtMillis = activeRuntime.startedAtMillis,
                        mqttHost = mqttHost,
                    ),
                )
            }.getOrDefault(NoOpSessionEventLog)
        log(activeRuntime, activeRuntime.startedAtMillis, "session_started")
        try {
            while (!activeRuntime.stop.isCompleted) {
                mutableState.value =
                    if (attempt == 0) {
                        BabyStationSessionState.Connecting
                    } else {
                        BabyStationSessionState.Reconnecting
                    }
                try {
                    runConnectionAttempt(activeRuntime, attempt + 1)
                    if (activeRuntime.stop.isCompleted) break
                } catch (error: AuthenticationRequiredException) {
                    failed = true
                    completionReason = "authentication_required"
                    logError(activeRuntime, "session_authentication_failed", error)
                    mutableState.value = BabyStationSessionState.Failed("Sign in required")
                    return
                } catch (error: CancellationException) {
                    completionReason = "cancelled"
                    logError(activeRuntime, "session_cancelled", error)
                    throw error
                } catch (error: Exception) {
                    logError(activeRuntime, "mqtt_connection_attempt_failed", error)
                    if (activeRuntime.stop.isCompleted) break
                }
                attempt++
                mutableState.value = BabyStationSessionState.Reconnecting
                val reconnectDelayMillis = reconnectDelayMillis(attempt)
                log(
                    activeRuntime,
                    "mqtt_reconnect_scheduled",
                    mapOf(
                        "next_attempt" to (attempt + 1).toString(),
                        "delay_ms" to reconnectDelayMillis.toString(),
                    ),
                )
                if (waitForStop(activeRuntime, reconnectDelayMillis)) break
            }
        } finally {
            if (activeRuntime.stop.isCompleted) logStopRequested(activeRuntime)
            log(
                activeRuntime,
                "session_stopped",
                mapOf("reason" to completionReason),
            )
            runCatching { activeRuntime.eventLog.close() }
            synchronized(this) {
                if (runtime === activeRuntime) runtime = null
            }
            if (!failed) mutableState.value = BabyStationSessionState.Ready
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private suspend fun runConnectionAttempt(activeRuntime: SessionRuntime, attempt: Int) {
        val credentials = credentialsProvider.credentials()
        val clientId = clientIdStore.getOrCreate()
        val connectionId = newId()
        val requestId = newId()
        val statusTopic = MqttTopics.clientStatus(credentials.accountId, clientId)
        val disconnects = Channel<Throwable>(Channel.CONFLATED)
        val connectRequest =
            MqttConnectRequest(
                host = mqttHost,
                clientId = clientId,
                accessToken = credentials.accessToken,
                willTopic = statusTopic,
                willPayload =
                    MqttPayloads.disconnected(
                        connectionId = connectionId,
                        requestId = requestId,
                        atMillis = 0,
                        reason = "unexpected",
                    ),
            )
        log(
            activeRuntime,
            "mqtt_connect_started",
            mapOf(
                "attempt" to attempt.toString(),
                "host" to mqttHost,
                "client_id" to clientId,
                "connection_id" to connectionId,
                "request_id" to requestId,
                "will_topic" to statusTopic,
            ),
        )
        val connection = coroutineScope {
            val connecting = async {
                transport.connect(connectRequest) { cause ->
                    logError(activeRuntime, "mqtt_connection_lost", cause)
                    disconnects.trySend(cause)
                }
            }
            select<MqttConnection?> {
                activeRuntime.stop.onAwait {
                    logStopRequested(activeRuntime)
                    connecting.cancel()
                    null
                }
                connecting.onAwait { it }
            }
        } ?: return
        log(
            activeRuntime,
            "mqtt_connected",
            mapOf(
                "attempt" to attempt.toString(),
                "client_id" to clientId,
                "connection_id" to connectionId,
            ),
        )
        activeRuntime.connection = connection
        val announcement =
            SessionAnnouncement(
                clientId = clientId,
                connectionId = connectionId,
                sessionId = activeRuntime.sessionId,
                name = activeRuntime.name,
                startedAtMillis = activeRuntime.startedAtMillis,
            )
        var cleanStop = false
        var setupCompleted = false
        try {
            publish(
                activeRuntime,
                connection,
                statusTopic,
                MqttPayloads.connected(connectionId, requestId, nowMillis()),
            )
            subscribe(
                activeRuntime,
                connection,
                MqttTopics.parentStations(credentials.accountId),
            ) { message ->
                respondToParent(
                    activeRuntime,
                    connection,
                    credentials.accountId,
                    announcement,
                    message,
                )
            }
            subscribe(
                activeRuntime,
                connection,
                MqttTopics.webRtcInbox(credentials.accountId, clientId),
            ) { message ->
                if (isCurrent(activeRuntime, connection)) mutableWebRtcSignals.tryEmit(message)
            }
            if (activeRuntime.stop.isCompleted) {
                logStopRequested(activeRuntime)
                cleanStop = true
                return
            }
            publish(
                activeRuntime,
                connection,
                MqttTopics.babyStations(credentials.accountId),
                MqttPayloads.babyStation(announcement),
            )
            if (activeRuntime.stop.isCompleted) {
                logStopRequested(activeRuntime)
                cleanStop = true
                return
            }
            setupCompleted = true
            mutableState.value =
                BabyStationSessionState.Active(
                    sessionId = activeRuntime.sessionId,
                    connectionId = connectionId,
                )
            log(
                activeRuntime,
                "session_active",
                mapOf("connection_id" to connectionId),
            )
            cleanStop = select {
                activeRuntime.stop.onAwait {
                    logStopRequested(activeRuntime)
                    true
                }
                disconnects.onReceive { false }
            }
        } finally {
            activeRuntime.connection = null
            if (cleanStop || activeRuntime.stop.isCompleted || !setupCompleted) {
                runCatching {
                    publish(
                        activeRuntime,
                        connection,
                        statusTopic,
                        MqttPayloads.disconnected(
                            connectionId = connectionId,
                            requestId = requestId,
                            atMillis = nowMillis(),
                            reason = "clean",
                        ),
                    )
                }.onFailure { error ->
                    logError(activeRuntime, "mqtt_clean_status_failed", error)
                }
            }
            log(activeRuntime, "mqtt_disconnect_started")
            runCatching { connection.disconnect() }
                .onSuccess { log(activeRuntime, "mqtt_disconnected") }
                .onFailure { error -> logError(activeRuntime, "mqtt_disconnect_failed", error) }
        }
    }

    private fun respondToParent(
        activeRuntime: SessionRuntime,
        connection: MqttConnection,
        accountId: String,
        announcement: SessionAnnouncement,
        message: MqttInboundMessage,
    ) {
        val parent = MqttPayloads.parentStation(message, accountId) ?: return
        scope.launch {
            if (!isCurrent(activeRuntime, connection)) return@launch
            runCatching {
                publish(
                    activeRuntime,
                    connection,
                    MqttTopics.controlInbox(accountId, parent.clientId),
                    MqttPayloads.babyStationControl(announcement, nowMillis()),
                )
            }.onFailure { error ->
                logError(activeRuntime, "mqtt_parent_response_failed", error)
            }
        }
    }

    private suspend fun publish(
        activeRuntime: SessionRuntime,
        connection: MqttConnection,
        topic: String,
        payload: String,
    ) {
        try {
            connection.publish(topic, payload)
            logMessage(activeRuntime, direction = "outbound", topic = topic, payload = payload)
        } catch (error: Exception) {
            logMessageError(activeRuntime, direction = "outbound", topic = topic, error = error)
            throw error
        }
    }

    private suspend fun subscribe(
        activeRuntime: SessionRuntime,
        connection: MqttConnection,
        topicFilter: String,
        onMessage: (MqttInboundMessage) -> Unit,
    ) {
        try {
            connection.subscribe(topicFilter) { message ->
                logMessage(
                    activeRuntime,
                    direction = "inbound",
                    topic = message.topic,
                    payload = message.payload,
                )
                onMessage(message)
            }
            log(activeRuntime, "mqtt_subscribed", mapOf("topic" to topicFilter))
        } catch (error: Exception) {
            logMessageError(
                activeRuntime,
                direction = "subscribe",
                topic = topicFilter,
                error = error,
            )
            throw error
        }
    }

    private fun logMessage(
        activeRuntime: SessionRuntime,
        direction: String,
        topic: String,
        payload: String,
    ) {
        log(
            activeRuntime,
            "mqtt_message",
            mapOf(
                "direction" to direction,
                "topic" to topic,
                "payload_type" to MqttPayloads.messageType(payload),
                "payload_bytes" to payload.toByteArray(Charsets.UTF_8).size.toString(),
            ),
        )
    }

    private fun logMessageError(
        activeRuntime: SessionRuntime,
        direction: String,
        topic: String,
        error: Throwable,
    ) {
        log(
            activeRuntime,
            "mqtt_message_failed",
            mapOf(
                "direction" to direction,
                "topic" to topic,
                "error_class" to error.javaClass.name,
                "cause_classes" to error.causeClasses(),
            ),
        )
    }

    private fun log(
        activeRuntime: SessionRuntime,
        event: String,
        fields: Map<String, String> = emptyMap(),
    ) {
        log(activeRuntime, nowMillis(), event, fields)
    }

    private fun log(
        activeRuntime: SessionRuntime,
        atMillis: Long,
        event: String,
        fields: Map<String, String> = emptyMap(),
    ) {
        runCatching { activeRuntime.eventLog.record(atMillis, event, fields) }
    }

    private fun logError(activeRuntime: SessionRuntime, event: String, error: Throwable) {
        log(
            activeRuntime,
            event,
            mapOf(
                "error_class" to error.javaClass.name,
                "cause_classes" to error.causeClasses(),
            ),
        )
    }

    private fun logStopRequested(activeRuntime: SessionRuntime) {
        val requestedAt = synchronized(activeRuntime) {
            if (activeRuntime.stopRequestLogged) return
            activeRuntime.stopRequestLogged = true
            activeRuntime.stopRequestedAtMillis ?: nowMillis()
        }
        log(activeRuntime, requestedAt, "session_stop_requested")
    }

    private fun isCurrent(activeRuntime: SessionRuntime, connection: MqttConnection): Boolean =
        synchronized(this) {
            runtime === activeRuntime &&
                !activeRuntime.stop.isCompleted &&
                activeRuntime.connection === connection
        }

    private suspend fun waitForStop(activeRuntime: SessionRuntime, delayMillis: Long): Boolean =
        withTimeoutOrNull(delayMillis) { activeRuntime.stop.await() } != null

    private fun reconnectDelayMillis(attempt: Int): Long {
        var delay = INITIAL_RECONNECT_DELAY_MILLIS
        repeat((attempt - 1).coerceAtLeast(0)) {
            delay = min(delay * 2, MAX_RECONNECT_DELAY_MILLIS)
        }
        return delay
    }

    private class SessionRuntime(
        val name: String,
        val sessionId: String,
        val startedAtMillis: Long,
        val stop: CompletableDeferred<Unit> = CompletableDeferred(),
        @Volatile var connection: MqttConnection? = null,
        @Volatile var eventLog: SessionEventLog = NoOpSessionEventLog,
        var stopRequestedAtMillis: Long? = null,
        var stopRequestLogged: Boolean = false,
    )

    private companion object {
        const val INITIAL_RECONNECT_DELAY_MILLIS = 1_000L
        const val MAX_RECONNECT_DELAY_MILLIS = 30_000L
    }
}

private fun Throwable.causeClasses(): String = generateSequence(this) { error -> error.cause }
    .take(MAX_LOGGED_CAUSES)
    .joinToString(separator = " -> ") { error -> error.javaClass.name }

private const val MAX_LOGGED_CAUSES = 6
