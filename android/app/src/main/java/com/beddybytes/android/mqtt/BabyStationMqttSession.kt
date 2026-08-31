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
        activeRuntime.stop.complete(Unit)
    }

    private suspend fun runSession(activeRuntime: SessionRuntime) {
        var attempt = 0
        var failed = false
        try {
            while (!activeRuntime.stop.isCompleted) {
                mutableState.value =
                    if (attempt == 0) {
                        BabyStationSessionState.Connecting
                    } else {
                        BabyStationSessionState.Reconnecting
                    }
                try {
                    runConnectionAttempt(activeRuntime)
                    if (activeRuntime.stop.isCompleted) break
                } catch (_: AuthenticationRequiredException) {
                    failed = true
                    mutableState.value = BabyStationSessionState.Failed("Sign in required")
                    return
                } catch (error: CancellationException) {
                    throw error
                } catch (_: Exception) {
                    if (activeRuntime.stop.isCompleted) break
                }
                attempt++
                mutableState.value = BabyStationSessionState.Reconnecting
                if (waitForStop(activeRuntime, reconnectDelayMillis(attempt))) break
            }
        } finally {
            synchronized(this) {
                if (runtime === activeRuntime) runtime = null
            }
            if (!failed) mutableState.value = BabyStationSessionState.Ready
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private suspend fun runConnectionAttempt(activeRuntime: SessionRuntime) {
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
        val connection = coroutineScope {
            val connecting = async {
                transport.connect(connectRequest) { cause -> disconnects.trySend(cause) }
            }
            select<MqttConnection?> {
                activeRuntime.stop.onAwait {
                    connecting.cancel()
                    null
                }
                connecting.onAwait { it }
            }
        } ?: return
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
            connection.publish(
                statusTopic,
                MqttPayloads.connected(connectionId, requestId, nowMillis()),
            )
            connection.subscribe(MqttTopics.parentStations(credentials.accountId)) { message ->
                respondToParent(
                    activeRuntime,
                    connection,
                    credentials.accountId,
                    announcement,
                    message,
                )
            }
            connection.subscribe(
                MqttTopics.webRtcInbox(credentials.accountId, clientId),
            ) { message ->
                if (isCurrent(activeRuntime, connection)) mutableWebRtcSignals.tryEmit(message)
            }
            if (activeRuntime.stop.isCompleted) {
                cleanStop = true
                return
            }
            connection.publish(
                MqttTopics.babyStations(credentials.accountId),
                MqttPayloads.babyStation(announcement),
            )
            if (activeRuntime.stop.isCompleted) {
                cleanStop = true
                return
            }
            setupCompleted = true
            mutableState.value =
                BabyStationSessionState.Active(
                    sessionId = activeRuntime.sessionId,
                    connectionId = connectionId,
                )
            cleanStop = select {
                activeRuntime.stop.onAwait { true }
                disconnects.onReceive { false }
            }
        } finally {
            activeRuntime.connection = null
            if (cleanStop || activeRuntime.stop.isCompleted || !setupCompleted) {
                runCatching {
                    connection.publish(
                        statusTopic,
                        MqttPayloads.disconnected(
                            connectionId = connectionId,
                            requestId = requestId,
                            atMillis = nowMillis(),
                            reason = "clean",
                        ),
                    )
                }
            }
            runCatching { connection.disconnect() }
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
                connection.publish(
                    MqttTopics.controlInbox(accountId, parent.clientId),
                    MqttPayloads.babyStationControl(announcement, nowMillis()),
                )
            }
        }
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
    )

    private companion object {
        const val INITIAL_RECONNECT_DELAY_MILLIS = 1_000L
        const val MAX_RECONNECT_DELAY_MILLIS = 30_000L
    }
}
