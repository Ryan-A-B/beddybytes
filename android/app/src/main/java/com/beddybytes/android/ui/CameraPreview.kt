package com.beddybytes.android.ui

import android.graphics.Bitmap
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.RenderEffect
import android.media.Image
import android.view.TextureView
import android.widget.ImageView
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.beddybytes.android.BuildConfig

@Suppress("FunctionName")
@Composable
internal fun CameraPreview(
    cameraId: String,
    grayscale: Boolean,
    processedOutputEnabled: Boolean,
    recordingSession: DebugCameraRecordingSession?,
    onTelemetryChanged: (CameraTelemetry) -> Unit,
    onVideoFrame: (Image, Int) -> Unit,
    onProcessedVideoFrame: (Bitmap?, Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val currentTelemetryCallback by rememberUpdatedState(onTelemetryChanged)
    val currentVideoFrameCallback by rememberUpdatedState(onVideoFrame)
    val currentProcessedVideoFrameCallback by rememberUpdatedState(onProcessedVideoFrame)
    val textureView = remember(cameraId) { TextureView(context) }
    val grayscaleEffect =
        remember {
            val matrix = ColorMatrix().apply { setSaturation(0f) }
            RenderEffect
                .createColorFilterEffect(ColorMatrixColorFilter(matrix))
                .asComposeRenderEffect()
        }
    var cameraError by remember(cameraId) { mutableStateOf<String?>(null) }
    var telemetry by remember(cameraId) { mutableStateOf<CameraTelemetry?>(null) }
    var stackedPreviewFrame by remember(cameraId) {
        mutableStateOf<StackedPreviewFrame?>(null)
    }
    var rawFinalizing by remember(cameraId) { mutableStateOf(false) }
    var previewAspectRatio by remember(cameraId) { mutableFloatStateOf(DEFAULT_PREVIEW_ASPECT) }
    val engine =
        remember(cameraId, textureView) {
            Camera2PreviewEngine(
                context = context,
                cameraId = cameraId,
                textureView = textureView,
                onTelemetry = { update ->
                    textureView.post {
                        telemetry = update
                        currentTelemetryCallback(update)
                    }
                },
                onVideoFrame = { image, rotationDegrees ->
                    currentVideoFrameCallback(image, rotationDegrees)
                },
                onStackedFrame = { frame ->
                    currentProcessedVideoFrameCallback(
                        frame?.bitmap,
                        frame?.timestampNanoseconds ?: 0L,
                    )
                    textureView.post { stackedPreviewFrame = frame }
                },
                onRawFinalizingChanged = { finalizing ->
                    textureView.post { rawFinalizing = finalizing }
                },
                onPreviewAspectRatio = { aspectRatio ->
                    textureView.post { previewAspectRatio = aspectRatio }
                },
                onError = { error ->
                    textureView.post {
                        cameraError =
                            if (BuildConfig.DEBUG) {
                                "${error::class.java.simpleName}: ${error.message.orEmpty()}"
                            } else {
                                "Camera unavailable"
                            }
                    }
                },
            )
        }

    DisposableEffect(engine, lifecycleOwner) {
        val observer =
            LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> engine.start()
                    Lifecycle.Event.ON_STOP -> engine.stop()
                    else -> Unit
                }
            }
        lifecycleOwner.lifecycle.addObserver(observer)
        if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            engine.start()
        }

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            engine.close()
        }
    }

    LaunchedEffect(engine, processedOutputEnabled, recordingSession) {
        engine.setLowLightProcessing(
            enabled = processedOutputEnabled,
            recordingSession = recordingSession,
        )
    }

    BoxWithConstraints(
        modifier =
            modifier.graphicsLayer {
                renderEffect =
                    if (grayscale || telemetry?.automaticMonochrome == true) {
                        grayscaleEffect
                    } else {
                        null
                    }
            },
        contentAlignment = Alignment.Center,
    ) {
        val availableAspectRatio = maxWidth.value / maxHeight.value
        val previewModifier =
            if (availableAspectRatio > previewAspectRatio) {
                Modifier.fillMaxHeight().aspectRatio(previewAspectRatio)
            } else {
                Modifier.fillMaxWidth().aspectRatio(previewAspectRatio)
            }
        AndroidView(
            factory = { textureView },
            modifier = previewModifier,
        )
        stackedPreviewFrame?.let { frame ->
            AndroidView(
                factory = { viewContext ->
                    ImageView(viewContext).apply {
                        scaleType = ImageView.ScaleType.FIT_CENTER
                        contentDescription = "Eight-frame low-light stack"
                    }
                },
                update = { imageView -> imageView.setImageBitmap(frame.bitmap) },
                modifier = previewModifier,
            )
        }
        cameraError?.let { errorMessage ->
            Text(
                text = errorMessage,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
        if (rawFinalizing) {
            Text(
                text = "Saving RAW…",
                modifier = Modifier.align(Alignment.BottomCenter),
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

private const val DEFAULT_PREVIEW_ASPECT = 3f / 4f
