package com.beddybytes.android.mqtt

import android.app.ActivityManager
import android.app.ApplicationExitInfo
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
    private var previousExitReported = false

    override fun create(context: SessionLogContext): SessionEventLog = runCatching {
        val root =
            appContext.getExternalFilesDir(SESSION_DIRECTORY)
                ?: File(appContext.filesDir, SESSION_DIRECTORY)
        val directory =
            File(root, sessionLogDirectoryName(context.sessionId, context.startedAtMillis))
        check(directory.mkdirs() || directory.isDirectory)
        val log = JsonLinesSessionEventLog(
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
        takePreviousProcessExit()?.let { exit ->
            log.record(
                atMillis = context.startedAtMillis,
                event = "previous_process_exit",
                fields =
                    mapOf(
                        "exit_timestamp_millis" to exit.timestamp.toString(),
                        "reason" to applicationExitReasonName(exit.reason),
                        "reason_code" to exit.reason.toString(),
                        "status" to exit.status.toString(),
                        "importance" to exit.importance.toString(),
                        "pss_kb" to exit.pss.toString(),
                        "rss_kb" to exit.rss.toString(),
                        "description" to safeExitDescription(exit.description),
                        "trace_file" to persistExitTrace(exit, directory),
                    ),
            )
        }
        log
    }.getOrElse { error ->
        Log.e(LOG_TAG, "Unable to create station event log: ${error.javaClass.name}")
        NoOpSessionEventLog
    }

    @Synchronized
    private fun takePreviousProcessExit(): ApplicationExitInfo? {
        if (previousExitReported) return null
        previousExitReported = true
        return runCatching {
            appContext
                .getSystemService(ActivityManager::class.java)
                .getHistoricalProcessExitReasons(appContext.packageName, 0, 1)
                .firstOrNull()
        }.getOrNull()
    }

    private fun persistExitTrace(exit: ApplicationExitInfo, directory: File): String {
        val trace = runCatching { exit.traceInputStream }.getOrNull() ?: return "none"
        val traceFile = File(directory, PREVIOUS_EXIT_TRACE_FILENAME)
        return runCatching {
            trace.use { input ->
                traceFile.outputStream().buffered().use { output ->
                    val buffer = ByteArray(8 * 1024)
                    var remaining = MAX_EXIT_TRACE_BYTES
                    while (remaining > 0) {
                        val read = input.read(buffer, 0, minOf(buffer.size, remaining))
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        remaining -= read
                    }
                }
            }
            PREVIOUS_EXIT_TRACE_FILENAME
        }.getOrElse {
            runCatching { traceFile.delete() }
            "unavailable"
        }
    }

    private companion object {
        const val SESSION_DIRECTORY = "station-sessions"
        const val LOG_FILENAME = "events.jsonl"
        const val LOG_TAG = "BeddyBytesSession"
        const val PREVIOUS_EXIT_TRACE_FILENAME = "previous-process-trace.txt"
        const val MAX_EXIT_TRACE_BYTES = 512 * 1024
    }
}

internal fun applicationExitReasonName(reason: Int): String = when (reason) {
    ApplicationExitInfo.REASON_EXIT_SELF -> "exit_self"
    ApplicationExitInfo.REASON_SIGNALED -> "signaled"
    ApplicationExitInfo.REASON_LOW_MEMORY -> "low_memory"
    ApplicationExitInfo.REASON_CRASH -> "crash"
    ApplicationExitInfo.REASON_CRASH_NATIVE -> "crash_native"
    ApplicationExitInfo.REASON_ANR -> "anr"
    ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "initialization_failure"
    ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "permission_change"
    ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "excessive_resource_usage"
    ApplicationExitInfo.REASON_USER_REQUESTED -> "user_requested"
    ApplicationExitInfo.REASON_USER_STOPPED -> "user_stopped"
    ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "dependency_died"
    ApplicationExitInfo.REASON_OTHER -> "other"
    ApplicationExitInfo.REASON_FREEZER -> "freezer"
    ApplicationExitInfo.REASON_PACKAGE_STATE_CHANGE -> "package_state_change"
    ApplicationExitInfo.REASON_PACKAGE_UPDATED -> "package_updated"
    else -> "unknown"
}

internal fun safeExitDescription(description: String?): String = description
    ?.replace(Regex("[\\p{Cc}\\p{Zl}\\p{Zp}]+"), " ")
    ?.take(MAX_EXIT_DESCRIPTION_LENGTH)
    ?: "none"

private const val MAX_EXIT_DESCRIPTION_LENGTH = 256

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
