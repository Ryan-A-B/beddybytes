package com.beddybytes.android.ui

import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.RenderEffect
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner

@Suppress("FunctionName")
@androidx.annotation.OptIn(markerClass = [ExperimentalCamera2Interop::class])
@Composable
fun CameraPreview(cameraId: String, grayscale: Boolean, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView =
        remember {
            PreviewView(context).apply {
                implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                scaleType = PreviewView.ScaleType.FILL_CENTER
            }
        }
    val grayscaleEffect =
        remember {
            val matrix = ColorMatrix().apply { setSaturation(0f) }
            RenderEffect
                .createColorFilterEffect(ColorMatrixColorFilter(matrix))
                .asComposeRenderEffect()
        }
    var cameraError by remember(cameraId) { mutableStateOf(false) }

    DisposableEffect(cameraId, lifecycleOwner) {
        val providerFuture = ProcessCameraProvider.getInstance(context)
        val executor = ContextCompat.getMainExecutor(context)
        providerFuture.addListener(
            {
                val provider = providerFuture.get()
                val selector =
                    CameraSelector
                        .Builder()
                        .addCameraFilter { cameraInfos ->
                            cameraInfos.filter { cameraInfo ->
                                Camera2CameraInfo.from(cameraInfo).cameraId == cameraId
                            }
                        }.build()
                val preview = Preview.Builder().build()
                preview.surfaceProvider = previewView.surfaceProvider

                runCatching {
                    provider.unbindAll()
                    provider.bindToLifecycle(lifecycleOwner, selector, preview)
                }.onFailure { cameraError = true }
            },
            executor,
        )

        onDispose {
            if (providerFuture.isDone) {
                providerFuture.get().unbindAll()
            }
        }
    }

    Box(
        modifier =
            modifier.graphicsLayer {
                renderEffect = if (grayscale) grayscaleEffect else null
            },
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            factory = { previewView },
            modifier = Modifier.fillMaxSize(),
        )
        if (cameraError) {
            Text(
                text = "Camera unavailable",
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
