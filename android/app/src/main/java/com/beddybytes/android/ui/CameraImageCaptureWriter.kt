package com.beddybytes.android.ui

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import androidx.core.graphics.createBitmap
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

internal fun brightnessGainBand(brightnessGain: Float): Int =
    brightnessGain.toInt().coerceIn(MINIMUM_GAIN_BAND, MAXIMUM_GAIN_BAND)

internal class CameraImageCaptureWriter(context: Context, private val cameraId: String) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val capturedGainBands = mutableSetOf<Int>()

    @Synchronized
    fun captureNewGainBand(
        width: Int,
        height: Int,
        averageLuma: ByteArray,
        brightenedLuma: ByteArray,
        brightnessGain: Float,
    ) {
        val gainBand = brightnessGainBand(brightnessGain)
        if (!capturedGainBands.add(gainBand)) return
        val averageCopy = averageLuma.copyOf()
        val brightenedCopy = brightenedLuma.copyOf()
        scope.launch {
            runCatching {
                val directory =
                    (
                        appContext.getExternalFilesDir(IMAGE_DIRECTORY)
                            ?: File(appContext.filesDir, IMAGE_DIRECTORY)
                        )
                        .apply { check(mkdirs() || isDirectory) }
                val timestamp = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
                val filenameTimestamp = timestamp.replace(':', '-').replace('.', '-')
                val prefix = "camera-$cameraId-${gainBand}x-$filenameTimestamp"
                writeGrayscalePng(
                    file = File(directory, "$prefix-stack-average.png"),
                    width = width,
                    height = height,
                    luma = averageCopy,
                )
                writeGrayscalePng(
                    file = File(directory, "$prefix-stack-brightened.png"),
                    width = width,
                    height = height,
                    luma = brightenedCopy,
                )
                File(directory, "$prefix-details.txt").writeText(
                    "utc=$timestamp\n" +
                        "camera_id=$cameraId\n" +
                        "resolution=${width}x$height\n" +
                        "stack_frames=8\n" +
                        "brightness_gain_band=${gainBand}x\n" +
                        "brightness_gain=$brightnessGain\n",
                )
            }.onFailure { error ->
                synchronized(this@CameraImageCaptureWriter) { capturedGainBands.remove(gainBand) }
                Log.e(LOG_TAG, "Unable to save camera diagnostic images", error)
            }
        }
    }

    private fun writeGrayscalePng(file: File, width: Int, height: Int, luma: ByteArray) {
        val pixels = IntArray(luma.size) { index ->
            val value = luma[index].toInt() and 0xff
            0xff000000.toInt() or (value shl 16) or (value shl 8) or value
        }
        val bitmap = createBitmap(width, height)
        try {
            bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
            FileOutputStream(file).use { output ->
                check(bitmap.compress(Bitmap.CompressFormat.PNG, PNG_QUALITY, output))
                output.fd.sync()
            }
        } finally {
            bitmap.recycle()
        }
    }

    private companion object {
        const val LOG_TAG = "CameraImageCapture"
        const val IMAGE_DIRECTORY = "camera-images"
        const val PNG_QUALITY = 100
    }
}

private const val MINIMUM_GAIN_BAND = 1
private const val MAXIMUM_GAIN_BAND = 4
