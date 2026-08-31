package com.beddybytes.android.ui

import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.DngCreator
import android.media.Image
import android.util.Log
import android.util.Size
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal class DebugRawFrameRecorder(
    private val cameraCharacteristics: CameraCharacteristics,
    private val rawSize: Size,
    private val rotationDegrees: Int,
    private val onStackedFrame: (StackedPreviewFrame?) -> Unit,
    private val onFinalizingChanged: (Boolean) -> Unit,
    private val onError: (Throwable) -> Unit,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val writeMutex = Mutex()
    private val pendingImages = linkedMapOf<Long, Image>()
    private val pendingResults = linkedMapOf<Long, CaptureResult>()
    private var session: RecordingSession? = null

    @Volatile
    var stackedFrameCount: Int = 0
        private set

    @Volatile
    var brightnessGain: Float? = null
        private set

    @Synchronized
    fun start(debugSession: DebugCameraRecordingSession) {
        if (session != null) return
        debugSession.ensureStarted()
        val directory = File(debugSession.directory, RAW_DIRECTORY).apply {
            check(mkdirs() || isDirectory)
        }
        val manifest = File(debugSession.directory, MANIFEST_FILENAME)
        manifest.writeText(
            "schema=beddybytes-raw-frames-v1\n" +
                "format=RAW_SENSOR_DNG\n" +
                "resolution=${rawSize.width}x${rawSize.height}\n" +
                "capture_interval_ms=$CAPTURE_INTERVAL_MILLISECONDS\n" +
                "frame,file,sensor_timestamp_ns,exposure_ns,frame_duration_ns,iso\n",
        )
        stackedFrameCount = 0
        brightnessGain = null
        onStackedFrame(null)
        session =
            RecordingSession(
                debugSession = debugSession,
                directory = directory,
                manifest = manifest,
                processor =
                    RawRollingStackProcessor(
                        characteristics = cameraCharacteristics,
                        width = rawSize.width,
                        height = rawSize.height,
                        rotationDegrees = rotationDegrees,
                        onFrame = { frame ->
                            val active =
                                synchronized(this@DebugRawFrameRecorder) {
                                    session?.debugSession === debugSession
                                }
                            if (active) {
                                stackedFrameCount = frame.sourceFrameCount
                                brightnessGain = frame.brightnessGain
                                onStackedFrame(frame)
                            }
                        },
                    ),
            )
    }

    @Synchronized
    fun stop() {
        val stoppedSession = session ?: return
        session = null
        stoppedSession.stopped = true
        closePendingImages()
        pendingResults.clear()
        stackedFrameCount = 0
        brightnessGain = null
        onStackedFrame(null)
        if (stoppedSession.inFlightWrites == 0) {
            finalizeSession(stoppedSession)
        } else {
            onFinalizingChanged(true)
        }
    }

    @Synchronized
    fun onImage(image: Image) {
        if (session == null) {
            image.close()
            return
        }
        pendingImages.put(image.timestamp, image)?.close()
        writePairIfReady(image.timestamp)
        trimPendingData()
    }

    @Synchronized
    fun onCaptureResult(result: CaptureResult) {
        if (session == null) return
        val timestamp = result.get(CaptureResult.SENSOR_TIMESTAMP) ?: return
        pendingResults[timestamp] = result
        writePairIfReady(timestamp)
        trimPendingData()
    }

    fun close() {
        stop()
    }

    @Synchronized
    private fun writePairIfReady(timestamp: Long) {
        val recordingSession = session ?: return
        val image = pendingImages[timestamp] ?: return
        val result = pendingResults[timestamp] ?: return
        pendingImages.remove(timestamp)
        pendingResults.remove(timestamp)
        val frameNumber = ++recordingSession.frameCount
        val filename = rawFrameFilename(frameNumber, timestamp)
        recordingSession.inFlightWrites++
        scope.launch {
            writeMutex.withLock {
                runCatching {
                    recordingSession.processor.onImage(image, result)
                    val active =
                        synchronized(this@DebugRawFrameRecorder) {
                            session?.debugSession === recordingSession.debugSession
                        }
                    if (active) {
                        stackedFrameCount = recordingSession.processor.frameCount
                        brightnessGain = recordingSession.processor.brightnessGain
                    }
                    val finalFile = File(recordingSession.directory, filename)
                    val partialFile = File(recordingSession.directory, "$filename.partial")
                    try {
                        DngCreator(cameraCharacteristics, result).use { creator ->
                            FileOutputStream(partialFile).use { output ->
                                creator.writeImage(output, image)
                                output.fd.sync()
                            }
                        }
                        check(partialFile.renameTo(finalFile))
                    } finally {
                        image.close()
                        partialFile.delete()
                    }
                    appendManifest(
                        recordingSession.manifest,
                        listOf(
                            frameNumber,
                            filename,
                            timestamp,
                            result.get(CaptureResult.SENSOR_EXPOSURE_TIME),
                            result.get(CaptureResult.SENSOR_FRAME_DURATION),
                            result.get(CaptureResult.SENSOR_SENSITIVITY),
                        ).joinToString(",") + "\n",
                    )
                }.onFailure { error ->
                    image.close()
                    Log.e(LOG_TAG, "Unable to process or write RAW frame", error)
                    onError(error)
                }
                finishWrite(recordingSession)
            }
        }
    }

    @Synchronized
    private fun trimPendingData() {
        while (pendingImages.size > MAX_PENDING_PAIRS) {
            pendingImages.remove(pendingImages.keys.first())?.close()
        }
        while (pendingResults.size > MAX_PENDING_PAIRS) {
            pendingResults.remove(pendingResults.keys.first())
        }
    }

    private fun closePendingImages() {
        pendingImages.values.forEach(Image::close)
        pendingImages.clear()
    }

    private fun appendManifest(file: File, text: String) {
        synchronized(file.absolutePath.intern()) { file.appendText(text) }
    }

    @Synchronized
    private fun finishWrite(recordingSession: RecordingSession) {
        recordingSession.inFlightWrites--
        if (recordingSession.stopped && recordingSession.inFlightWrites == 0) {
            finalizeSession(recordingSession)
        }
    }

    private fun finalizeSession(recordingSession: RecordingSession) {
        appendManifest(recordingSession.manifest, "recording_stopped=true\n")
        recordingSession.debugSession.markRawFinalized()
        onFinalizingChanged(false)
    }

    private data class RecordingSession(
        val debugSession: DebugCameraRecordingSession,
        val directory: File,
        val manifest: File,
        val processor: RawRollingStackProcessor,
        var frameCount: Int = 0,
        var inFlightWrites: Int = 0,
        var stopped: Boolean = false,
    )

    internal companion object {
        const val CAPTURE_INTERVAL_MILLISECONDS = 1_000L
        private const val LOG_TAG = "DebugRawFrameRecorder"
        private const val RAW_DIRECTORY = "raw"
        private const val MANIFEST_FILENAME = "raw-frames.csv"
        private const val MAX_PENDING_PAIRS = 4
    }
}

internal fun rawFrameFilename(frameNumber: Int, sensorTimestampNanoseconds: Long): String =
    "frame-${frameNumber.toString().padStart(6, '0')}-$sensorTimestampNanoseconds.dng"
