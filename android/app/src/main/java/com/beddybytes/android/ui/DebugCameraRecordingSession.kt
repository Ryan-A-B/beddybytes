package com.beddybytes.android.ui

import android.content.Context
import java.io.File
import java.time.Instant
import java.time.format.DateTimeFormatter

internal class DebugCameraRecordingSession(
    context: Context,
    val cameraId: String,
    val startedAt: Instant = Instant.now(),
) {
    private val appContext = context.applicationContext
    val directory =
        File(
            appContext.getExternalFilesDir(SESSION_DIRECTORY)
                ?: File(appContext.filesDir, SESSION_DIRECTORY),
            recordingDirectoryName(cameraId, startedAt),
        )
    private var started = false
    private var closed = false

    @Synchronized
    fun ensureStarted() {
        if (started) return
        check(!closed)
        check(directory.mkdirs() || directory.isDirectory)
        File(directory, SESSION_FILENAME).writeText(
            "schema=beddybytes-camera-recording-v1\n" +
                "started_utc=${DateTimeFormatter.ISO_INSTANT.format(startedAt)}\n" +
                "camera_id=$cameraId\n" +
                "raw_capture_interval_ms=${DebugRawFrameRecorder.CAPTURE_INTERVAL_MILLISECONDS}\n",
        )
        started = true
    }

    @Synchronized
    fun close() {
        if (closed) return
        closed = true
        if (started) {
            File(directory, SESSION_FILENAME).appendText(
                "stopped_utc=${DateTimeFormatter.ISO_INSTANT.format(Instant.now())}\n",
            )
        }
    }

    @Synchronized
    fun markRawFinalized() {
        if (!started) return
        File(directory, SESSION_FILENAME).appendText(
            "raw_finalized_utc=${DateTimeFormatter.ISO_INSTANT.format(Instant.now())}\n",
        )
    }

    private companion object {
        const val SESSION_DIRECTORY = "camera-sessions"
        const val SESSION_FILENAME = "session.txt"
    }
}

internal fun recordingDirectoryName(cameraId: String, startedAt: Instant): String {
    val safeCameraId = cameraId.replace(Regex("[^A-Za-z0-9._-]"), "_")
    val timestamp =
        DateTimeFormatter.ISO_INSTANT
            .format(startedAt)
            .replace(':', '-')
            .replace('.', '-')
    return "camera-$safeCameraId-$timestamp"
}
