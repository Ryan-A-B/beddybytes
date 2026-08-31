package com.beddybytes.android.ui

import android.graphics.Bitmap
import android.media.Image
import androidx.core.graphics.createBitmap
import java.nio.ByteBuffer

internal class RollingLumaAverager(
    private val width: Int,
    private val height: Int,
    private val capacity: Int = DEFAULT_CAPACITY,
) {
    private val pixelCount = width * height
    private val frames = Array(capacity) { ByteArray(pixelCount) }
    private val sums = IntArray(pixelCount)
    private var nextFrameIndex = 0

    var frameCount: Int = 0
        private set

    init {
        require(width > 0 && height > 0)
        require(capacity > 0)
    }

    fun add(frame: ByteArray): Boolean {
        require(frame.size == pixelCount)
        val destination = frames[nextFrameIndex]
        for (index in 0 until pixelCount) {
            val incoming = frame[index].toInt() and 0xff
            if (frameCount == capacity) {
                sums[index] -= destination[index].toInt() and 0xff
            }
            destination[index] = frame[index]
            sums[index] += incoming
        }
        nextFrameIndex = (nextFrameIndex + 1) % capacity
        if (frameCount < capacity) frameCount++
        return frameCount == capacity
    }

    fun writeAverage(destination: ByteArray) {
        require(destination.size == pixelCount)
        check(frameCount == capacity)
        for (index in 0 until pixelCount) {
            destination[index] = (sums[index] / capacity).toByte()
        }
    }

    fun reset() {
        sums.fill(0)
        frameCount = 0
        nextFrameIndex = 0
    }

    private companion object {
        const val DEFAULT_CAPACITY = 8
    }
}

internal data class StackedPreviewFrame(
    val bitmap: Bitmap,
    val sourceFrameCount: Int,
    val brightnessGain: Float,
)

internal class AdaptiveLumaBrightener {
    private val histogram = IntArray(LUMA_VALUE_COUNT)

    fun apply(source: ByteArray, destination: ByteArray): Float {
        require(source.size == destination.size)
        histogram.fill(0)
        source.forEach { value -> histogram[value.toInt() and 0xff]++ }
        val percentileTarget = (source.size * TARGET_PERCENTILE).toInt().coerceAtLeast(1)
        var cumulativePixels = 0
        var percentileLuma = 0
        for (luma in histogram.indices) {
            cumulativePixels += histogram[luma]
            if (cumulativePixels >= percentileTarget) {
                percentileLuma = luma
                break
            }
        }
        val usefulPercentileLuma = percentileLuma.coerceAtLeast(1)
        val gain =
            (TARGET_LUMA.toFloat() / usefulPercentileLuma)
                .coerceIn(MINIMUM_GAIN, MAXIMUM_GAIN)
        for (index in source.indices) {
            val input = source[index].toInt() and 0xff
            val output = (input * gain).toInt().coerceIn(0, WHITE_POINT)
            destination[index] = output.toByte()
        }
        return gain
    }

    private companion object {
        const val LUMA_VALUE_COUNT = 256
        const val WHITE_POINT = 235
        const val TARGET_LUMA = 96
        const val TARGET_PERCENTILE = 0.70f
        const val MINIMUM_GAIN = 1f
        const val MAXIMUM_GAIN = 4f
    }
}

internal class RollingLumaFrameProcessor(
    private val width: Int,
    private val height: Int,
    private val rotationDegrees: Int,
    private val onFrame: (StackedPreviewFrame?) -> Unit,
    private val onDiagnosticPair: (
        (averageLuma: ByteArray, brightenedLuma: ByteArray, brightnessGain: Float) -> Unit
    )? = null,
) {
    private val averager = RollingLumaAverager(width, height)
    private val incomingLuma = ByteArray(width * height)
    private val averagedLuma = ByteArray(width * height)
    private val brightenedLuma = ByteArray(width * height)
    private val brightener = AdaptiveLumaBrightener()
    private val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
    private val outputWidth =
        if (normalizedRotation == 90 || normalizedRotation == 270) height else width
    private val outputHeight =
        if (normalizedRotation == 90 || normalizedRotation == 270) width else height
    private val outputPixels = IntArray(outputWidth * outputHeight)
    private val outputBitmaps =
        Array(OUTPUT_BITMAP_COUNT) {
            createBitmap(outputWidth, outputHeight)
        }
    private var nextOutputBitmapIndex = 0
    private var enabled = false
    private var lastOutputTimestampNanoseconds = Long.MIN_VALUE

    var brightnessGain: Float? = null
        private set

    val frameCount: Int
        get() = averager.frameCount

    fun setEnabled(value: Boolean) {
        if (enabled == value) return
        enabled = value
        averager.reset()
        brightnessGain = null
        lastOutputTimestampNanoseconds = Long.MIN_VALUE
        if (!value) onFrame(null)
    }

    fun onImage(image: Image) {
        if (!enabled) return
        copyLuma(image, incomingLuma)
        if (!averager.add(incomingLuma)) return
        val timestamp = image.timestamp
        if (lastOutputTimestampNanoseconds != Long.MIN_VALUE &&
            timestamp - lastOutputTimestampNanoseconds < OUTPUT_INTERVAL_NANOSECONDS
        ) {
            return
        }
        lastOutputTimestampNanoseconds = timestamp
        averager.writeAverage(averagedLuma)
        brightnessGain = brightener.apply(averagedLuma, brightenedLuma)
        onDiagnosticPair?.invoke(averagedLuma, brightenedLuma, brightnessGain ?: 1f)
        onFrame(
            StackedPreviewFrame(
                bitmap = grayscaleBitmap(brightenedLuma),
                sourceFrameCount = averager.frameCount,
                brightnessGain = brightnessGain ?: 1f,
            ),
        )
    }

    private fun copyLuma(image: Image, output: ByteArray) {
        val plane = image.planes.first()
        val buffer = plane.buffer
        val rowStride = plane.rowStride
        val pixelStride = plane.pixelStride
        copyStridedLuma(
            buffer = buffer,
            width = width,
            height = height,
            rowStride = rowStride,
            pixelStride = pixelStride,
            destination = output,
        )
    }

    private fun grayscaleBitmap(luma: ByteArray): Bitmap {
        for (sourceY in 0 until height) {
            for (sourceX in 0 until width) {
                val value = luma[sourceY * width + sourceX].toInt() and 0xff
                val colour = 0xff000000.toInt() or (value shl 16) or (value shl 8) or value
                val destinationIndex =
                    when (normalizedRotation) {
                        90 -> sourceX * outputWidth + (outputWidth - 1 - sourceY)

                        180 ->
                            (outputHeight - 1 - sourceY) * outputWidth +
                                (outputWidth - 1 - sourceX)

                        270 -> (outputHeight - 1 - sourceX) * outputWidth + sourceY

                        else -> sourceY * outputWidth + sourceX
                    }
                outputPixels[destinationIndex] = colour
            }
        }
        val bitmap = outputBitmaps[nextOutputBitmapIndex]
        nextOutputBitmapIndex = (nextOutputBitmapIndex + 1) % outputBitmaps.size
        bitmap.setPixels(outputPixels, 0, outputWidth, 0, 0, outputWidth, outputHeight)
        return bitmap
    }

    private companion object {
        const val OUTPUT_INTERVAL_NANOSECONDS = 500_000_000L
        const val OUTPUT_BITMAP_COUNT = 2
    }
}

internal fun copyStridedLuma(
    buffer: ByteBuffer,
    width: Int,
    height: Int,
    rowStride: Int,
    pixelStride: Int,
    destination: ByteArray,
) {
    require(destination.size == width * height)
    val bufferOffset = buffer.position()
    val finalSourceIndex =
        bufferOffset + (height - 1) * rowStride + (width - 1) * pixelStride
    require(finalSourceIndex < buffer.limit())
    for (row in 0 until height) {
        val rowStart = row * rowStride
        val outputStart = row * width
        for (column in 0 until width) {
            destination[outputStart + column] =
                buffer.get(bufferOffset + rowStart + column * pixelStride)
        }
    }
}
