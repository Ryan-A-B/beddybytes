package com.beddybytes.android.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.Configuration
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureFailure
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.TotalCaptureResult
import android.hardware.camera2.params.MeteringRectangle
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.Image
import android.media.ImageReader
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import android.view.TextureView
import com.beddybytes.android.BuildConfig
import java.util.concurrent.Executor
import kotlin.math.max

internal class Camera2PreviewEngine(
    context: Context,
    private val cameraId: String,
    private val textureView: TextureView,
    private val onTelemetry: (CameraTelemetry) -> Unit,
    private val onVideoFrame: (Image, Int) -> Unit,
    private val onStackedFrame: (StackedPreviewFrame?) -> Unit,
    private val onRawFinalizingChanged: (Boolean) -> Unit,
    private val onPreviewAspectRatio: (Float) -> Unit,
    private val onError: (Throwable) -> Unit,
) {
    private val appContext = context.applicationContext
    private val cameraManager = appContext.getSystemService(CameraManager::class.java)
    private val characteristics = cameraManager.getCameraCharacteristics(cameraId)
    private val logicalCaptureConfiguration = CameraCaptureConfiguration.from(characteristics)
    private val physicalTarget = choosePhysicalCameraTarget(cameraManager, characteristics)
    private val captureCharacteristics = physicalTarget?.characteristics ?: characteristics
    private val captureConfiguration = CameraCaptureConfiguration.from(captureCharacteristics)
    private val previewSize = choosePreviewSize(captureCharacteristics)
    private val rawCaptureSize =
        if (BuildConfig.DEBUG) chooseRawCaptureSize(characteristics) else null
    private val imageCaptureWriter =
        if (BuildConfig.DEBUG) CameraImageCaptureWriter(appContext, cameraId) else null
    private val lock = Any()

    @Volatile
    private var running = false
    private var opening = false
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var previewSurface: Surface? = null
    private var imageReader: ImageReader? = null
    private var rawImageReader: ImageReader? = null
    private var rollingFrameProcessor: RollingLumaFrameProcessor? = null
    private var rawCaptureController: DebugRawCaptureController? = null
    private var requestedRecordingSession: DebugCameraRecordingSession? = null

    private val surfaceTextureListener =
        object : TextureView.SurfaceTextureListener {
            override fun onSurfaceTextureAvailable(
                surface: SurfaceTexture,
                width: Int,
                height: Int,
            ) {
                configureTransform(width, height)
                openCameraIfReady()
            }

            override fun onSurfaceTextureSizeChanged(
                surface: SurfaceTexture,
                width: Int,
                height: Int,
            ) {
                configureTransform(width, height)
            }

            override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                closeCameraResources()
                return true
            }

            override fun onSurfaceTextureUpdated(surface: SurfaceTexture) = Unit
        }

    init {
        textureView.surfaceTextureListener = surfaceTextureListener
        val portrait =
            appContext.resources.configuration.orientation == Configuration.ORIENTATION_PORTRAIT
        val aspectRatio =
            if (portrait) {
                previewSize.height.toFloat() / previewSize.width
            } else {
                previewSize.width.toFloat() / previewSize.height
            }
        onPreviewAspectRatio(aspectRatio)
    }

    fun start() {
        synchronized(lock) {
            if (running) return
            running = true
            cameraThread = HandlerThread("BeddyBytes-Camera2-$cameraId").also { it.start() }
            cameraHandler = Handler(cameraThread!!.looper)
        }
        if (textureView.isAvailable) {
            configureTransform(textureView.width, textureView.height)
            openCameraIfReady()
        }
    }

    fun stop() {
        val thread: HandlerThread?
        synchronized(lock) {
            if (!running) return
            running = false
            closeCameraResourcesLocked()
            thread = cameraThread
            cameraHandler = null
            cameraThread = null
        }
        thread?.quitSafely()
    }

    fun close() {
        stop()
        textureView.surfaceTextureListener = null
    }

    fun setRawFrameRecordingSession(session: DebugCameraRecordingSession?) {
        if (!BuildConfig.DEBUG) return
        val handler =
            synchronized(lock) {
                requestedRecordingSession = session
                cameraHandler
            } ?: return
        handler.post {
            val (controller, requestedSession) =
                synchronized(lock) { rawCaptureController to requestedRecordingSession }
            controller?.setRecordingSession(requestedSession)
        }
    }

    @SuppressLint("MissingPermission")
    private fun openCameraIfReady() {
        val handler = synchronized(lock) {
            if (!running || opening || cameraDevice != null || !textureView.isAvailable) return
            opening = true
            cameraHandler
        } ?: return

        runCatching {
            cameraManager.openCamera(
                cameraId,
                object : CameraDevice.StateCallback() {
                    override fun onOpened(camera: CameraDevice) {
                        synchronized(lock) {
                            opening = false
                            if (!running) {
                                camera.close()
                                return
                            }
                            cameraDevice = camera
                        }
                        createPreviewSession(camera, handler)
                    }

                    override fun onDisconnected(camera: CameraDevice) {
                        camera.close()
                        synchronized(lock) {
                            opening = false
                            if (cameraDevice == camera) cameraDevice = null
                        }
                    }

                    override fun onError(camera: CameraDevice, error: Int) {
                        camera.close()
                        synchronized(lock) {
                            opening = false
                            if (cameraDevice == camera) cameraDevice = null
                        }
                        reportError(
                            IllegalStateException("Camera2 error $error for camera $cameraId"),
                        )
                    }
                },
                handler,
            )
        }.onFailure { error ->
            synchronized(lock) { opening = false }
            reportError(error)
        }
    }

    private fun createPreviewSession(camera: CameraDevice, handler: Handler) {
        val surfaceTexture = textureView.surfaceTexture ?: return
        surfaceTexture.setDefaultBufferSize(previewSize.width, previewSize.height)
        val surface = Surface(surfaceTexture)
        val reader =
            ImageReader.newInstance(
                previewSize.width,
                previewSize.height,
                ImageFormat.YUV_420_888,
                IMAGE_READER_CAPACITY,
            )
        val processor =
            RollingLumaFrameProcessor(
                width = previewSize.width,
                height = previewSize.height,
                rotationDegrees = imageRotationDegrees(),
                onFrame = onStackedFrame,
                onDiagnosticPair = { averageLuma, brightenedLuma, brightnessGain ->
                    imageCaptureWriter?.captureNewGainBand(
                        width = previewSize.width,
                        height = previewSize.height,
                        averageLuma = averageLuma,
                        brightenedLuma = brightenedLuma,
                        brightnessGain = brightnessGain,
                    )
                },
            )
        val rawRecorder =
            rawCaptureSize?.let { size ->
                DebugRawFrameRecorder(
                    cameraCharacteristics = characteristics,
                    rawSize = size,
                    rotationDegrees = imageRotationDegrees(),
                    onStackedFrame = onStackedFrame,
                    onFinalizingChanged = onRawFinalizingChanged,
                    onError = ::reportError,
                )
            }
        val rawReader =
            rawCaptureSize?.let { size ->
                ImageReader.newInstance(
                    size.width,
                    size.height,
                    ImageFormat.RAW_SENSOR,
                    RAW_IMAGE_READER_CAPACITY,
                )
            }
        rawReader?.setOnImageAvailableListener(
            { availableReader ->
                runCatching {
                    while (true) {
                        val image = availableReader.acquireNextImage() ?: break
                        rawRecorder?.onImage(image) ?: image.close()
                    }
                }.onFailure(::reportError)
            },
            handler,
        )
        reader.setOnImageAvailableListener(
            { availableReader ->
                runCatching {
                    availableReader.acquireLatestImage()?.use { image ->
                        onVideoFrame(image, imageRotationDegrees())
                        processor.onImage(image)
                    }
                }.onFailure { error ->
                    processor.setEnabled(false)
                    reportError(error)
                }
            },
            handler,
        )
        synchronized(lock) {
            previewSurface?.release()
            previewSurface = surface
            imageReader?.close()
            imageReader = reader
            rawImageReader?.close()
            rawImageReader = rawReader
            rollingFrameProcessor = processor
        }
        val previewOutput = physicalOutputConfiguration(surface)
        val processingOutput = physicalOutputConfiguration(reader.surface)
        val executor = Executor { command -> handler.post(command) }
        val outputs =
            buildList {
                add(previewOutput)
                add(processingOutput)
                rawReader?.surface?.let { rawSurface -> add(OutputConfiguration(rawSurface)) }
            }
        val sessionConfiguration =
            SessionConfiguration(
                SessionConfiguration.SESSION_REGULAR,
                outputs,
                executor,
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        synchronized(lock) {
                            if (!running || cameraDevice != camera) {
                                session.close()
                                return
                            }
                            captureSession = session
                        }
                        startRepeatingPreview(
                            camera = camera,
                            session = session,
                            previewSurface = surface,
                            processingSurface = reader.surface,
                            handler = handler,
                            processor = processor,
                            rawSurface = rawReader?.surface,
                            rawRecorder = rawRecorder,
                        )
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        reportError(IllegalStateException("Unable to configure camera $cameraId"))
                    }
                },
            )
        runCatching { camera.createCaptureSession(sessionConfiguration) }
            .onFailure(::reportError)
    }

    private fun startRepeatingPreview(
        camera: CameraDevice,
        session: CameraCaptureSession,
        previewSurface: Surface,
        processingSurface: Surface,
        handler: Handler,
        processor: RollingLumaFrameProcessor,
        rawSurface: Surface?,
        rawRecorder: DebugRawFrameRecorder?,
    ) {
        runCatching {
            val requestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
            requestBuilder.addTarget(previewSurface)
            requestBuilder.addTarget(processingSurface)
            configureAutomaticControls(requestBuilder)
            val exposureController =
                Camera2ExposureController(
                    configuration = logicalCaptureConfiguration,
                    requestBuilder = requestBuilder,
                )
            val tracker =
                LowLightTelemetryTracker(
                    cameraId = cameraId,
                    captureConfiguration = captureConfiguration,
                    resolutionProvider = { previewSize.width to previewSize.height },
                    targetPhysicalCameraId = physicalTarget?.id,
                    rollingStackFrameCountProvider = {
                        rawRecorder?.stackedFrameCount ?: processor.frameCount
                    },
                    rollingStackBrightnessGainProvider = {
                        rawRecorder?.brightnessGain ?: processor.brightnessGain
                    },
                )
            lateinit var callback: CameraCaptureSession.CaptureCallback
            callback =
                object : CameraCaptureSession.CaptureCallback() {
                    override fun onCaptureCompleted(
                        session: CameraCaptureSession,
                        request: CaptureRequest,
                        result: TotalCaptureResult,
                    ) {
                        val captureResult = captureResultForPhysical(result, physicalTarget?.id)
                        val requestChanged =
                            runCatching { exposureController.onCapture(captureResult) }
                                .getOrElse { error ->
                                    reportError(error)
                                    false
                                }
                        if (requestChanged) {
                            runCatching {
                                session.setRepeatingRequest(
                                    requestBuilder.build(),
                                    callback,
                                    handler,
                                )
                            }.onFailure(::reportError)
                        }
                        processor.setEnabled(
                            rawRecorder == null &&
                                exposureController.state.mode ==
                                ExposureControlMode.MANUAL_LOW_LIGHT,
                        )
                        tracker.onCapture(
                            result = captureResult,
                            exposureControlState = exposureController.state,
                            activePhysicalCameraId =
                                physicalTarget?.id
                                    ?: result.get(
                                        CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID,
                                    ),
                        )?.let(onTelemetry)
                    }
                }
            session.setRepeatingRequest(requestBuilder.build(), callback, handler)
            val rawController =
                if (rawSurface != null && rawRecorder != null) {
                    DebugRawCaptureController(
                        session = session,
                        requestBuilder = requestBuilder,
                        rawSurface = rawSurface,
                        handler = handler,
                        recorder = rawRecorder,
                        onError = ::reportError,
                    )
                } else {
                    null
                }
            val requestedSession =
                synchronized(lock) {
                    rawCaptureController?.close()
                    rawCaptureController = rawController
                    requestedRecordingSession
                }
            rawController?.setRecordingSession(requestedSession)
        }.onFailure(::reportError)
    }

    private fun configureAutomaticControls(builder: CaptureRequest.Builder) {
        builder.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
        builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
        builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_AUTO)
        captureConfiguration.requestedFrameRateRange?.let { range ->
            builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, range)
        }

        val afModes = characteristics.get(
            CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES,
        ) ?: intArrayOf()
        val afMode =
            when {
                afModes.contains(CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_PICTURE) ->
                    CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_PICTURE

                afModes.contains(CameraMetadata.CONTROL_AF_MODE_AUTO) ->
                    CameraMetadata.CONTROL_AF_MODE_AUTO

                else -> CameraMetadata.CONTROL_AF_MODE_OFF
            }
        builder.set(CaptureRequest.CONTROL_AF_MODE, afMode)

        val activeArray = characteristics.get(CameraCharacteristics.SENSOR_INFO_ACTIVE_ARRAY_SIZE)
        val maxAeRegions = characteristics.get(CameraCharacteristics.CONTROL_MAX_REGIONS_AE) ?: 0
        if (activeArray != null && maxAeRegions > 0) {
            val width = activeArray.width() / 2
            val height = activeArray.height() / 2
            val left = activeArray.centerX() - width / 2
            val top = activeArray.centerY() - height / 2
            builder.set(
                CaptureRequest.CONTROL_AE_REGIONS,
                arrayOf(
                    MeteringRectangle(
                        left,
                        top,
                        width,
                        height,
                        MeteringRectangle.METERING_WEIGHT_MAX,
                    ),
                ),
            )
        }

        val oisModes =
            characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_OPTICAL_STABILIZATION)
                ?: intArrayOf()
        if (oisModes.contains(CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON)) {
            builder.set(
                CaptureRequest.LENS_OPTICAL_STABILIZATION_MODE,
                CameraMetadata.LENS_OPTICAL_STABILIZATION_MODE_ON,
            )
        }
    }

    private fun physicalOutputConfiguration(surface: Surface): OutputConfiguration =
        OutputConfiguration(surface).also { output ->
            physicalTarget?.id?.let(output::setPhysicalCameraId)
        }

    private fun imageRotationDegrees(): Int {
        val sensorOrientation =
            captureCharacteristics.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 0
        val displayDegrees =
            when (textureView.display?.rotation ?: Surface.ROTATION_0) {
                Surface.ROTATION_90 -> 90
                Surface.ROTATION_180 -> 180
                Surface.ROTATION_270 -> 270
                else -> 0
            }
        val frontFacing =
            captureCharacteristics.get(CameraCharacteristics.LENS_FACING) ==
                CameraCharacteristics.LENS_FACING_FRONT
        return if (frontFacing) {
            (sensorOrientation + displayDegrees) % 360
        } else {
            (sensorOrientation - displayDegrees + 360) % 360
        }
    }

    private fun configureTransform(viewWidth: Int, viewHeight: Int) {
        if (viewWidth == 0 || viewHeight == 0) return
        val rotation = textureView.display?.rotation ?: Surface.ROTATION_0
        val matrix = Matrix()
        val viewRect = RectF(0f, 0f, viewWidth.toFloat(), viewHeight.toFloat())
        val centerX = viewRect.centerX()
        val centerY = viewRect.centerY()
        when (rotation) {
            Surface.ROTATION_90,
            Surface.ROTATION_270,
            -> {
                val bufferRect =
                    RectF(0f, 0f, previewSize.height.toFloat(), previewSize.width.toFloat())
                bufferRect.offset(centerX - bufferRect.centerX(), centerY - bufferRect.centerY())
                matrix.setRectToRect(viewRect, bufferRect, Matrix.ScaleToFit.FILL)
                val scale =
                    max(
                        viewHeight.toFloat() / previewSize.height,
                        viewWidth.toFloat() / previewSize.width,
                    )
                matrix.postScale(scale, scale, centerX, centerY)
                matrix.postRotate(90f * (rotation - 2), centerX, centerY)
            }

            Surface.ROTATION_180 -> matrix.postRotate(180f, centerX, centerY)
        }
        textureView.setTransform(matrix)
    }

    private fun closeCameraResources() {
        synchronized(lock) { closeCameraResourcesLocked() }
    }

    private fun closeCameraResourcesLocked() {
        opening = false
        captureSession?.close()
        captureSession = null
        rawCaptureController?.close()
        rawCaptureController = null
        cameraDevice?.close()
        cameraDevice = null
        previewSurface?.release()
        previewSurface = null
        imageReader?.close()
        imageReader = null
        rawImageReader?.close()
        rawImageReader = null
        rollingFrameProcessor = null
        onStackedFrame(null)
    }

    private fun reportError(error: Throwable) {
        if (error !is CameraAccessException || running) onError(error)
    }

    private companion object {
        const val IMAGE_READER_CAPACITY = 3
        const val RAW_IMAGE_READER_CAPACITY = 3
    }
}

private class DebugRawCaptureController(
    private val session: CameraCaptureSession,
    private val requestBuilder: CaptureRequest.Builder,
    private val rawSurface: Surface,
    private val handler: Handler,
    private val recorder: DebugRawFrameRecorder,
    private val onError: (Throwable) -> Unit,
) {
    private var recordingSession: DebugCameraRecordingSession? = null
    private var closed = false
    private val captureCallback =
        object : CameraCaptureSession.CaptureCallback() {
            override fun onCaptureCompleted(
                session: CameraCaptureSession,
                request: CaptureRequest,
                result: TotalCaptureResult,
            ) {
                recorder.onCaptureResult(result)
            }

            override fun onCaptureFailed(
                session: CameraCaptureSession,
                request: CaptureRequest,
                failure: CaptureFailure,
            ) {
                onError(
                    IllegalStateException(
                        "RAW capture failed with reason ${failure.reason}",
                    ),
                )
            }
        }
    private val captureRunnable = Runnable(::captureFrame)

    fun setRecordingSession(value: DebugCameraRecordingSession?) {
        if (closed || recordingSession === value) return
        handler.removeCallbacks(captureRunnable)
        recorder.stop()
        recordingSession = value
        if (value != null) {
            runCatching { recorder.start(value) }
                .onSuccess { handler.post(captureRunnable) }
                .onFailure(onError)
        }
    }

    fun close() {
        if (closed) return
        closed = true
        handler.removeCallbacks(captureRunnable)
        recordingSession = null
        recorder.close()
    }

    private fun captureFrame() {
        if (closed || recordingSession == null) return
        runCatching {
            requestBuilder.addTarget(rawSurface)
            val request = try {
                requestBuilder.build()
            } finally {
                requestBuilder.removeTarget(rawSurface)
            }
            session.capture(request, captureCallback, handler)
        }.onFailure { error ->
            setRecordingSession(null)
            onError(error)
            return
        }
        handler.postDelayed(captureRunnable, DebugRawFrameRecorder.CAPTURE_INTERVAL_MILLISECONDS)
    }
}

private class Camera2ExposureController(
    private val configuration: CameraCaptureConfiguration,
    private val requestBuilder: CaptureRequest.Builder,
) {
    var state = ExposureControlState(ExposureControlMode.AUTO)
        private set

    private var darkFrames = 0
    private var brightFrames = 0
    private var manualStartedAtNanoseconds: Long? = null
    private var probeFrames = 0
    private var probeDarkFrames = 0

    fun onCapture(result: CaptureResult): Boolean {
        val timestamp = result.get(CaptureResult.SENSOR_TIMESTAMP) ?: return false
        val exposure = result.get(CaptureResult.SENSOR_EXPOSURE_TIME)
        val frameDuration = result.get(CaptureResult.SENSOR_FRAME_DURATION)
        val iso = result.get(CaptureResult.SENSOR_SENSITIVITY)
        val dark = isDarkCapture(exposure, frameDuration, iso)

        return when (state.mode) {
            ExposureControlMode.AUTO -> {
                darkFrames = if (dark) darkFrames + 1 else 0
                if (darkFrames >= DARK_FRAMES_TO_ADAPT) enterLowLight(timestamp) else false
            }

            ExposureControlMode.ISO_PRIORITY -> {
                val clearlyBright = exposure != null && exposure < BRIGHT_EXPOSURE_NANOSECONDS
                brightFrames = if (clearlyBright) brightFrames + 1 else 0
                if (brightFrames >= BRIGHT_FRAMES_TO_AUTO) enterAuto() else false
            }

            ExposureControlMode.MANUAL_LOW_LIGHT -> {
                val startedAt = manualStartedAtNanoseconds ?: timestamp
                if (timestamp - startedAt >= MANUAL_PROBE_INTERVAL_NANOSECONDS) {
                    enterAutoProbe()
                } else {
                    false
                }
            }

            ExposureControlMode.AUTO_PROBE -> {
                probeFrames++
                if (dark) probeDarkFrames++
                if (probeFrames < AUTO_PROBE_FRAMES) {
                    false
                } else if (probeDarkFrames >= DARK_FRAMES_TO_ADAPT) {
                    enterLowLight(timestamp)
                } else {
                    state = ExposureControlState(ExposureControlMode.AUTO)
                    darkFrames = 0
                    false
                }
            }
        }
    }

    private fun enterLowLight(timestamp: Long): Boolean = when (
        preferredLowLightExposureMode(
            manualSensorSupported = configuration.manualSensorSupported,
            isoPrioritySupported = configuration.isoPrioritySupported,
        )
    ) {
        ExposureControlMode.MANUAL_LOW_LIGHT -> enterManualLowLight(timestamp)
        ExposureControlMode.ISO_PRIORITY -> enterIsoPriority()
        else -> false
    }

    private fun enterIsoPriority(): Boolean {
        val iso = configuration.sensorSensitivityRange?.upper ?: return false
        requestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
        if (Build.VERSION.SDK_INT >= 36) {
            requestBuilder.set(
                CaptureRequest.CONTROL_AE_PRIORITY_MODE,
                CameraMetadata.CONTROL_AE_PRIORITY_MODE_SENSOR_SENSITIVITY_PRIORITY,
            )
        }
        requestBuilder.set(CaptureRequest.SENSOR_SENSITIVITY, iso)
        requestBuilder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, null)
        requestBuilder.set(CaptureRequest.SENSOR_FRAME_DURATION, null)
        state =
            ExposureControlState(
                mode = ExposureControlMode.ISO_PRIORITY,
                requestedSensitivityIso = iso,
            )
        darkFrames = 0
        brightFrames = 0
        return true
    }

    private fun enterManualLowLight(timestamp: Long): Boolean {
        val plan =
            manualExposurePlan(
                maximumExposureNanoseconds =
                    configuration.sensorExposureTimeRangeNanoseconds?.upper,
                maximumSensitivityIso = configuration.sensorSensitivityRange?.upper,
                lowestAdvertisedFramesPerSecond =
                    configuration.requestedFrameRateRange?.lower,
                maximumFrameDurationNanoseconds =
                    configuration.maxFrameDurationNanoseconds,
            ) ?: return false
        val exposure = plan.exposureNanoseconds
        val iso = plan.sensitivityIso
        val frameDuration = plan.frameDurationNanoseconds
        requestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_OFF)
        if (Build.VERSION.SDK_INT >= 36) {
            requestBuilder.set(
                CaptureRequest.CONTROL_AE_PRIORITY_MODE,
                CameraMetadata.CONTROL_AE_PRIORITY_MODE_OFF,
            )
        }
        requestBuilder.set(
            CaptureRequest.SENSOR_EXPOSURE_TIME,
            exposure,
        )
        requestBuilder.set(
            CaptureRequest.SENSOR_SENSITIVITY,
            iso,
        )
        requestBuilder.set(
            CaptureRequest.SENSOR_FRAME_DURATION,
            frameDuration,
        )
        if (configuration.highQualityNoiseReductionSupported) {
            requestBuilder.set(
                CaptureRequest.NOISE_REDUCTION_MODE,
                CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY,
            )
        }
        state =
            ExposureControlState(
                mode = ExposureControlMode.MANUAL_LOW_LIGHT,
                requestedExposureTimeNanoseconds = exposure,
                requestedSensitivityIso = iso,
            )
        manualStartedAtNanoseconds = timestamp
        darkFrames = 0
        return true
    }

    private fun enterAutoProbe(): Boolean {
        applyAutoRequest()
        state = ExposureControlState(ExposureControlMode.AUTO_PROBE)
        probeFrames = 0
        probeDarkFrames = 0
        return true
    }

    private fun enterAuto(): Boolean {
        applyAutoRequest()
        state = ExposureControlState(ExposureControlMode.AUTO)
        darkFrames = 0
        brightFrames = 0
        return true
    }

    private fun applyAutoRequest() {
        requestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
        if (Build.VERSION.SDK_INT >= 36) {
            requestBuilder.set(
                CaptureRequest.CONTROL_AE_PRIORITY_MODE,
                CameraMetadata.CONTROL_AE_PRIORITY_MODE_OFF,
            )
        }
        requestBuilder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, null)
        requestBuilder.set(CaptureRequest.SENSOR_SENSITIVITY, null)
        requestBuilder.set(CaptureRequest.SENSOR_FRAME_DURATION, null)
    }

    private fun isDarkCapture(exposure: Long?, frameDuration: Long?, iso: Int?): Boolean =
        exposure != null &&
            frameDuration != null &&
            iso != null &&
            exposure >= frameDuration * 9 / 10 &&
            iso >= DARK_ISO_THRESHOLD

    private companion object {
        const val DARK_ISO_THRESHOLD = 3_200
        const val DARK_FRAMES_TO_ADAPT = 8
        const val BRIGHT_FRAMES_TO_AUTO = 60
        const val BRIGHT_EXPOSURE_NANOSECONDS = 20_000_000L
        const val MANUAL_PROBE_INTERVAL_NANOSECONDS = 15_000_000_000L
        const val AUTO_PROBE_FRAMES = 30
    }
}

internal data class ManualExposurePlan(
    val exposureNanoseconds: Long,
    val sensitivityIso: Int,
    val frameDurationNanoseconds: Long,
)

internal fun manualExposurePlan(
    maximumExposureNanoseconds: Long?,
    maximumSensitivityIso: Int?,
    lowestAdvertisedFramesPerSecond: Int?,
    maximumFrameDurationNanoseconds: Long?,
): ManualExposurePlan? {
    val maximumExposure = maximumExposureNanoseconds ?: return null
    val maximumIso = maximumSensitivityIso ?: return null
    val cadenceFrameDuration =
        lowestAdvertisedFramesPerSecond
            ?.takeIf { it > 0 }
            ?.let { 1_000_000_000L / it }
            ?: maximumExposure
    val desiredFrameDuration =
        max(cadenceFrameDuration, maximumExposure + SENSOR_READOUT_HEADROOM_NANOSECONDS)
    val frameDuration =
        maximumFrameDurationNanoseconds?.let(desiredFrameDuration::coerceAtMost)
            ?: desiredFrameDuration
    val exposure =
        maximumExposure.coerceAtMost(
            (frameDuration - MINIMUM_SENSOR_READOUT_HEADROOM_NANOSECONDS).coerceAtLeast(1L),
        )
    return ManualExposurePlan(
        exposureNanoseconds = exposure,
        sensitivityIso = maximumIso,
        frameDurationNanoseconds = frameDuration,
    )
}

private const val SENSOR_READOUT_HEADROOM_NANOSECONDS = 50_000_000L
private const val MINIMUM_SENSOR_READOUT_HEADROOM_NANOSECONDS = 1_000_000L

private data class PhysicalCameraTarget(val id: String, val characteristics: CameraCharacteristics)

private fun captureResultForPhysical(
    result: TotalCaptureResult,
    physicalCameraId: String?,
): CaptureResult {
    val id = physicalCameraId ?: return result
    if (Build.VERSION.SDK_INT >= 36) {
        return result.physicalCameraTotalResults[id] ?: result
    }
    @Suppress("DEPRECATION")
    return result.physicalCameraResults[id] ?: result
}

private fun choosePhysicalCameraTarget(
    cameraManager: CameraManager,
    logicalCharacteristics: CameraCharacteristics,
): PhysicalCameraTarget? = logicalCharacteristics.physicalCameraIds
    .mapNotNull { id ->
        runCatching {
            PhysicalCameraTarget(id, cameraManager.getCameraCharacteristics(id))
        }.getOrNull()
    }
    .filter { target ->
        target.characteristics
            .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            ?.getOutputSizes(ImageFormat.YUV_420_888)
            ?.isNotEmpty() == true
    }
    .maxByOrNull { target -> lowLightPhysicalCameraScore(target.characteristics) }

private fun lowLightPhysicalCameraScore(characteristics: CameraCharacteristics): Double {
    val sensorSize = characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
    val aperture =
        characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)?.minOrNull()
    if (sensorSize == null || aperture == null || aperture <= 0f) return Double.NEGATIVE_INFINITY
    return (sensorSize.width * sensorSize.height / (aperture * aperture)).toDouble()
}

private fun choosePreviewSize(characteristics: CameraCharacteristics): Size {
    val configurationMap =
        characteristics
            .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
    val textureSizes = configurationMap?.getOutputSizes(SurfaceTexture::class.java).orEmpty()
    val yuvSizes = configurationMap?.getOutputSizes(ImageFormat.YUV_420_888).orEmpty().toSet()
    val sizes = textureSizes.filter(yuvSizes::contains)
    return sizes.firstOrNull { it.width == 1440 && it.height == 1080 }
        ?: sizes
            .filter { it.width.toLong() * it.height <= 1920L * 1080 }
            .maxByOrNull { it.width.toLong() * it.height }
        ?: sizes.firstOrNull()
        ?: Size(1280, 720)
}

private fun chooseRawCaptureSize(characteristics: CameraCharacteristics): Size? {
    val capabilities =
        characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) ?: intArrayOf()
    if (!capabilities.contains(CameraMetadata.REQUEST_AVAILABLE_CAPABILITIES_RAW)) return null
    return characteristics
        .get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        ?.getOutputSizes(ImageFormat.RAW_SENSOR)
        .orEmpty()
        .maxByOrNull { size -> size.width.toLong() * size.height }
}
