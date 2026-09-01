package com.beddybytes.android.babystation

import android.content.Context
import android.graphics.Bitmap
import com.beddybytes.android.BuildConfig
import com.beddybytes.android.mqtt.BabyStationSessionController
import com.beddybytes.android.mqtt.BabyStationSessionState
import com.beddybytes.android.mqtt.BabyStationStartRequest
import com.beddybytes.android.ui.Camera2PreviewEngine
import com.beddybytes.android.ui.CameraTelemetry
import com.beddybytes.android.ui.CameraTelemetryLogger
import com.beddybytes.android.ui.DebugCameraRecordingSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

private const val DEFAULT_PREVIEW_ASPECT = 3f / 4f

data class ActiveCameraState(
    val frame: Bitmap? = null,
    val telemetry: CameraTelemetry? = null,
    val error: String? = null,
    val rawFinalizing: Boolean = false,
    val previewAspectRatio: Float = DEFAULT_PREVIEW_ASPECT,
)

internal class ActiveBabyStationSession(
    context: Context,
    private val session: BabyStationSessionController,
    private val scope: CoroutineScope,
) {
    private val appContext = context.applicationContext
    private val mutableCameraState = MutableStateFlow(ActiveCameraState())
    private var capture: ActiveCapture? = null

    @Volatile
    private var started = false

    val state: StateFlow<BabyStationSessionState> = session.state
    val cameraState: StateFlow<ActiveCameraState> = mutableCameraState.asStateFlow()

    init {
        scope.launch {
            state.collect { state ->
                if (
                    started &&
                    (
                        state == BabyStationSessionState.Ready ||
                            state is BabyStationSessionState.Failed
                        )
                ) {
                    closeCapture("session_finished")
                    synchronized(this@ActiveBabyStationSession) { started = false }
                }
            }
        }
    }

    @Synchronized
    fun start(request: BabyStationStartRequest) {
        if (started) return
        started = true
        mutableCameraState.value = ActiveCameraState()
        session.start(request)
        session.recordEvent("foreground_session_started")
        request.cameraId?.let(::openCapture)
    }

    fun stop(reason: String) {
        session.recordEvent("foreground_session_stop_requested", mapOf("reason" to reason))
        closeCapture(reason)
        session.stop()
    }

    fun recordEvent(event: String, fields: Map<String, String> = emptyMap()) {
        session.recordEvent(event, fields)
    }

    private fun openCapture(cameraId: String) {
        runCatching {
            val recordingSession =
                if (BuildConfig.DEBUG) DebugCameraRecordingSession(appContext, cameraId) else null
            val telemetryLogger =
                recordingSession?.let { CameraTelemetryLogger(appContext, cameraId, it) }
            val engine =
                Camera2PreviewEngine(
                    context = appContext,
                    cameraId = cameraId,
                    textureView = null,
                    onTelemetry = { telemetry ->
                        telemetryLogger?.record(telemetry)
                        mutableCameraState.value =
                            mutableCameraState.value.copy(telemetry = telemetry, error = null)
                    },
                    onVideoFrame = session::onCameraFrame,
                    onStackedFrame = { frame ->
                        session.onProcessedCameraFrame(
                            frame?.bitmap,
                            frame?.timestampNanoseconds ?: 0L,
                        )
                        mutableCameraState.value =
                            mutableCameraState.value.copy(frame = frame?.bitmap)
                    },
                    onRawFinalizingChanged = { finalizing ->
                        mutableCameraState.value =
                            mutableCameraState.value.copy(rawFinalizing = finalizing)
                    },
                    onPreviewAspectRatio = { aspectRatio ->
                        mutableCameraState.value =
                            mutableCameraState.value.copy(previewAspectRatio = aspectRatio)
                    },
                    onError = { error ->
                        val message =
                            if (BuildConfig.DEBUG) {
                                "${error::class.java.simpleName}: ${error.message.orEmpty()}"
                            } else {
                                "Camera unavailable"
                            }
                        mutableCameraState.value =
                            mutableCameraState.value.copy(error = message)
                        session.recordEvent(
                            "camera_error",
                            mapOf("error_class" to error.javaClass.name),
                        )
                    },
                )
            capture = ActiveCapture(engine, recordingSession, telemetryLogger)
            engine.start()
            engine.setLowLightProcessing(enabled = true, recordingSession = recordingSession)
            session.recordEvent("camera_capture_started", mapOf("camera_id" to cameraId))
        }.onFailure { error ->
            mutableCameraState.value =
                mutableCameraState.value.copy(
                    error =
                        if (BuildConfig.DEBUG) {
                            "${error::class.java.simpleName}: ${error.message.orEmpty()}"
                        } else {
                            "Camera unavailable"
                        },
                )
            session.recordEvent(
                "camera_capture_start_failed",
                mapOf("error_class" to error.javaClass.name),
            )
        }
    }

    @Synchronized
    private fun closeCapture(reason: String) {
        val stoppingCapture = capture ?: return
        capture = null
        session.recordEvent("camera_capture_stopping", mapOf("reason" to reason))
        stoppingCapture.engine.close()
        stoppingCapture.telemetryLogger?.close()
        stoppingCapture.recordingSession?.close()
        mutableCameraState.value = ActiveCameraState()
        session.recordEvent("camera_capture_stopped", mapOf("reason" to reason))
    }

    private data class ActiveCapture(
        val engine: Camera2PreviewEngine,
        val recordingSession: DebugCameraRecordingSession?,
        val telemetryLogger: CameraTelemetryLogger?,
    )
}
