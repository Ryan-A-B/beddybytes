package com.beddybytes.android.mqtt

import android.app.ApplicationExitInfo
import java.nio.file.Files
import java.time.Instant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class SessionEventLogTest {
    @Test
    fun `writes a timestamped JSON line header and event`() {
        val directory = Files.createTempDirectory("beddybytes-session-log").toFile()
        val file = directory.resolve("events.jsonl")
        val mirroredLines = mutableListOf<String>()
        val log =
            JsonLinesSessionEventLog(
                file = file,
                header =
                    mapOf(
                        "started_at_millis" to "1000",
                        "schema" to "beddybytes-station-events-v1",
                        "session_id" to "session-1",
                    ),
                onLine = mirroredLines::add,
            )

        log.record(
            atMillis = 2_000,
            event = "mqtt_message",
            fields = mapOf("direction" to "outbound", "payload_bytes" to "42"),
        )
        log.close()

        val lines = file.readLines().map { Json.parseToJsonElement(it).jsonObject }
        assertEquals(2, lines.size)
        assertEquals("log_header", lines[0].getValue("event").jsonPrimitive.content)
        assertEquals("1970-01-01T00:00:01Z", lines[0].getValue("at_utc").jsonPrimitive.content)
        assertEquals("session-1", lines[0].getValue("session_id").jsonPrimitive.content)
        assertEquals("mqtt_message", lines[1].getValue("event").jsonPrimitive.content)
        assertEquals("42", lines[1].getValue("payload_bytes").jsonPrimitive.content)
        assertEquals(2, mirroredLines.size)
    }

    @Test
    fun `session directory name is UTC timestamp and filesystem safe session id`() {
        assertEquals(
            "station-2026-09-01T01-02-03Z-session___1",
            sessionLogDirectoryName(
                sessionId = "session/+:1",
                startedAtMillis = Instant.parse("2026-09-01T01:02:03Z").toEpochMilli(),
            ),
        )
    }

    @Test
    fun `names native process exits and sanitizes their descriptions`() {
        assertEquals(
            "crash_native",
            applicationExitReasonName(ApplicationExitInfo.REASON_CRASH_NATIVE),
        )
        assertEquals("unknown", applicationExitReasonName(Int.MAX_VALUE))
        assertEquals("native crash details", safeExitDescription("native\ncrash\tdetails"))
        assertEquals("none", safeExitDescription(null))
    }
}
