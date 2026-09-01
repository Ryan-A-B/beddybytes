package com.beddybytes.android.mqtt

import android.content.Context
import android.os.Build
import android.util.Log
import com.beddybytes.android.BuildConfig
import java.io.BufferedWriter
import java.io.Closeable
import java.io.File
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal data class SessionLogContext(
    val sessionId: String,
    val stationName: String,
    val startedAtMillis: Long,
    val mqttHost: String,
)

internal fun interface SessionEventLogFactory {
    fun create(context: SessionLogContext): SessionEventLog
}

internal interface SessionEventLog : Closeable {
    fun record(atMillis: Long, event: String, fields: Map<String, String> = emptyMap())
}

internal object NoOpSessionEventLog : SessionEventLog {
    override fun record(atMillis: Long, event: String, fields: Map<String, String>) = Unit

    override fun close() = Unit
}

internal val NoOpSessionEventLogFactory = SessionEventLogFactory { NoOpSessionEventLog }

internal class AndroidSessionEventLogFactory(context: Context) : SessionEventLogFactory {
    private val appContext = context.applicationContext

    override fun create(context: SessionLogContext): SessionEventLog = runCatching {
        val root =
            appContext.getExternalFilesDir(SESSION_DIRECTORY)
                ?: File(appContext.filesDir, SESSION_DIRECTORY)
        val directory =
            File(root, sessionLogDirectoryName(context.sessionId, context.startedAtMillis))
        check(directory.mkdirs() || directory.isDirectory)
        JsonLinesSessionEventLog(
            file = File(directory, LOG_FILENAME),
            header =
                mapOf(
                    "schema" to "beddybytes-station-events-v1",
                    "started_at_millis" to context.startedAtMillis.toString(),
                    "session_id" to context.sessionId,
                    "station_name" to context.stationName,
                    "mqtt_host" to context.mqttHost,
                    "app_version" to BuildConfig.VERSION_NAME,
                    "build_type" to BuildConfig.BUILD_TYPE,
                    "flavor" to BuildConfig.FLAVOR,
                    "device_manufacturer" to Build.MANUFACTURER,
                    "device_model" to Build.MODEL,
                    "android_sdk" to Build.VERSION.SDK_INT.toString(),
                ),
            onLine = { line -> Log.i(LOG_TAG, line) },
        )
    }.getOrElse { error ->
        Log.e(LOG_TAG, "Unable to create station event log: ${error.javaClass.name}")
        NoOpSessionEventLog
    }

    private companion object {
        const val SESSION_DIRECTORY = "station-sessions"
        const val LOG_FILENAME = "events.jsonl"
        const val LOG_TAG = "BeddyBytesSession"
    }
}

internal class JsonLinesSessionEventLog(
    file: File,
    header: Map<String, String>,
    private val onLine: (String) -> Unit = {},
) : SessionEventLog {
    private var writer: BufferedWriter? = file.bufferedWriter()

    init {
        write(
            atMillis = header.getValue("started_at_millis").toLongOrNull() ?: 0,
            event = "log_header",
            fields = header - "started_at_millis",
        )
    }

    @Synchronized
    override fun record(atMillis: Long, event: String, fields: Map<String, String>) {
        write(atMillis, event, fields)
    }

    @Synchronized
    override fun close() {
        runCatching { writer?.close() }
        writer = null
    }

    private fun write(atMillis: Long, event: String, fields: Map<String, String>) {
        val activeWriter = writer ?: return
        val line =
            Json.encodeToString(
                JsonObject.serializer(),
                JsonObject(
                    buildMap {
                        fields.forEach { (key, value) -> put(key, JsonPrimitive(value)) }
                        put("at_utc", JsonPrimitive(Instant.ofEpochMilli(atMillis).toString()))
                        put("at_millis", JsonPrimitive(atMillis))
                        put("event", JsonPrimitive(event))
                    },
                ),
            )
        runCatching {
            activeWriter.appendLine(line)
            activeWriter.flush()
            onLine(line)
        }.onFailure {
            runCatching { activeWriter.close() }
            writer = null
        }
    }
}

internal fun sessionLogDirectoryName(sessionId: String, startedAtMillis: Long): String {
    val safeSessionId = sessionId.replace(Regex("[^A-Za-z0-9._-]"), "_")
    val timestamp =
        DateTimeFormatter.ISO_INSTANT
            .format(Instant.ofEpochMilli(startedAtMillis))
            .replace(':', '-')
            .replace('.', '-')
    return "station-$timestamp-$safeSessionId"
}
