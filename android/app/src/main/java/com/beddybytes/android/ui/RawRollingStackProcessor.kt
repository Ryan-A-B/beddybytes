package com.beddybytes.android.ui

import android.graphics.Bitmap
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureResult
import android.media.Image
import androidx.core.graphics.createBitmap
import java.nio.ByteBuffer
import kotlin.math.roundToInt

internal class RollingRawSignalAverager(
    private val pixelCount: Int,
    private val capacity: Int = DEFAULT_CAPACITY,
) {
    private val frames = Array(capacity) { IntArray(pixelCount) }
    private val sums = IntArray(pixelCount)
    private var nextFrameIndex = 0

    var frameCount: Int = 0
        private set

    init {
        require(pixelCount > 0)
        require(capacity > 0)
    }

    fun add(frame: IntArray): Boolean {
        require(frame.size == pixelCount)
        val destination = frames[nextFrameIndex]
        for (index in 0 until pixelCount) {
            if (frameCount == capacity) sums[index] -= destination[index]
            destination[index] = frame[index]
            sums[index] += frame[index]
        }
        nextFrameIndex = (nextFrameIndex + 1) % capacity
        if (frameCount < capacity) frameCount++
        return frameCount == capacity
    }

    fun writeSums(destination: IntArray) {
        require(destination.size == pixelCount)
        check(frameCount == capacity)
        sums.copyInto(destination)
    }

    fun reset() {
        frames.forEach { it.fill(0) }
        sums.fill(0)
        nextFrameIndex = 0
        frameCount = 0
    }

    private companion object {
        const val DEFAULT_CAPACITY = 8
    }
}

internal class RawSignalToneMapper(
    private val sourceFrameCount: Int = DEFAULT_SOURCE_FRAME_COUNT,
    private val photositesPerOutputPixel: Int = PHOTOSITES_PER_OUTPUT_PIXEL,
) {
    private val histogram = IntArray(MAXIMUM_BLOCK_SIGNAL + 1)

    fun apply(sourceSums: IntArray, destination: ByteArray): Float {
        require(sourceSums.size == destination.size)
        histogram.fill(0)
        sourceSums.forEach { sum ->
            val averageBlockSignal = (sum / sourceFrameCount).coerceIn(0, histogram.lastIndex)
            histogram[averageBlockSignal]++
        }
        val targetRank = (sourceSums.size * TARGET_PERCENTILE).toInt().coerceAtLeast(1)
        var cumulative = 0
        var percentileBlockSignal = 0
        for (signal in histogram.indices) {
            cumulative += histogram[signal]
            if (cumulative >= targetRank) {
                percentileBlockSignal = signal
                break
            }
        }
        val gain = rawBrightnessGain(percentileBlockSignal, photositesPerOutputPixel)
        val divisor = sourceFrameCount.toFloat() * photositesPerOutputPixel
        for (index in sourceSums.indices) {
            val signalPerPhotosite = sourceSums[index] / divisor
            destination[index] =
                (signalPerPhotosite * gain)
                    .roundToInt()
                    .coerceIn(0, OUTPUT_WHITE_LEVEL)
                    .toByte()
        }
        return gain
    }

    private companion object {
        const val DEFAULT_SOURCE_FRAME_COUNT = 8
        const val PHOTOSITES_PER_OUTPUT_PIXEL = 16
        const val MAXIMUM_BLOCK_SIGNAL = 65_535
        const val OUTPUT_WHITE_LEVEL = 235
        const val TARGET_PERCENTILE = 0.70f
    }
}

internal fun rawBrightnessGain(
    percentileBlockSignal: Int,
    photositesPerOutputPixel: Int = 16,
): Float {
    val signalPerPhotosite = percentileBlockSignal.toFloat() / photositesPerOutputPixel
    return (TARGET_OUTPUT_LUMA / signalPerPhotosite.coerceAtLeast(MINIMUM_SIGNAL))
        .coerceIn(MINIMUM_RAW_GAIN, MAXIMUM_RAW_GAIN)
}

internal fun binRawSensorFrame(
    buffer: ByteBuffer,
    width: Int,
    height: Int,
    rowStride: Int,
    pixelStride: Int,
    blackLevels: IntArray,
    destination: IntArray,
) {
    require(width % RAW_BIN_SIZE == 0 && height % RAW_BIN_SIZE == 0)
    require(pixelStride >= RAW_BYTES_PER_PIXEL)
    require(blackLevels.size == CFA_PATTERN_SIZE)
    val outputWidth = width / RAW_BIN_SIZE
    require(destination.size == outputWidth * (height / RAW_BIN_SIZE))
    val bufferOffset = buffer.position()
    val finalByteIndex =
        bufferOffset + (height - 1) * rowStride + (width - 1) * pixelStride + 1
    require(finalByteIndex < buffer.limit())
    var outputIndex = 0
    for (blockY in 0 until height step RAW_BIN_SIZE) {
        for (blockX in 0 until width step RAW_BIN_SIZE) {
            var blockSignal = 0
            for (offsetY in 0 until RAW_BIN_SIZE) {
                val sourceY = blockY + offsetY
                val rowStart = bufferOffset + sourceY * rowStride
                for (offsetX in 0 until RAW_BIN_SIZE) {
                    val sourceX = blockX + offsetX
                    val sourceIndex = rowStart + sourceX * pixelStride
                    val rawValue =
                        (buffer.get(sourceIndex).toInt() and 0xff) or
                            ((buffer.get(sourceIndex + 1).toInt() and 0xff) shl 8)
                    val blackLevel = blackLevels[(sourceY and 1) * 2 + (sourceX and 1)]
                    blockSignal += (rawValue - blackLevel).coerceAtLeast(0)
                }
            }
            destination[outputIndex++] = blockSignal
        }
    }
}

internal class RawRollingStackProcessor(
    characteristics: CameraCharacteristics,
    private val width: Int,
    private val height: Int,
    rotationDegrees: Int,
    private val onFrame: (StackedPreviewFrame) -> Unit,
) {
    private val staticBlackLevels =
        characteristics.get(CameraCharacteristics.SENSOR_BLACK_LEVEL_PATTERN)?.let { pattern ->
            intArrayOf(
                pattern.getOffsetForIndex(0, 0),
                pattern.getOffsetForIndex(1, 0),
                pattern.getOffsetForIndex(0, 1),
                pattern.getOffsetForIndex(1, 1),
            )
        } ?: error("RAW camera does not report a black level pattern")
    private val binnedWidth = width / RAW_BIN_SIZE
    private val binnedHeight = height / RAW_BIN_SIZE
    private val incomingSignal = IntArray(binnedWidth * binnedHeight)
    private val stackedSignal = IntArray(binnedWidth * binnedHeight)
    private val mappedLuma = ByteArray(binnedWidth * binnedHeight)
    private val averager = RollingRawSignalAverager(incomingSignal.size)
    private val toneMapper = RawSignalToneMapper()
    private val normalizedRotation = ((rotationDegrees % 360) + 360) % 360
    private val outputWidth =
        if (normalizedRotation == 90 || normalizedRotation == 270) binnedHeight else binnedWidth
    private val outputHeight =
        if (normalizedRotation == 90 || normalizedRotation == 270) binnedWidth else binnedHeight
    private val outputPixels = IntArray(outputWidth * outputHeight)
    private val outputBitmaps =
        Array(OUTPUT_BITMAP_COUNT) { createBitmap(outputWidth, outputHeight) }
    private var nextOutputBitmapIndex = 0

    var brightnessGain: Float? = null
        private set

    val frameCount: Int
        get() = averager.frameCount

    init {
        require(width % RAW_BIN_SIZE == 0 && height % RAW_BIN_SIZE == 0)
    }

    fun onImage(image: Image, result: CaptureResult) {
        if (result.get(CaptureResult.CONTROL_AE_MODE) != CameraMetadata.CONTROL_AE_MODE_OFF) return
        val dynamicBlackLevels =
            result.get(
                CaptureResult.SENSOR_DYNAMIC_BLACK_LEVEL,
            )?.map(Float::roundToInt)?.toIntArray()
        val plane = image.planes.first()
        binRawSensorFrame(
            buffer = plane.buffer,
            width = width,
            height = height,
            rowStride = plane.rowStride,
            pixelStride = plane.pixelStride,
            blackLevels = dynamicBlackLevels?.takeIf { it.size == CFA_PATTERN_SIZE }
                ?: staticBlackLevels,
            destination = incomingSignal,
        )
        if (!averager.add(incomingSignal)) return
        averager.writeSums(stackedSignal)
        brightnessGain = toneMapper.apply(stackedSignal, mappedLuma)
        onFrame(
            StackedPreviewFrame(
                bitmap = grayscaleBitmap(),
                sourceFrameCount = averager.frameCount,
                brightnessGain = brightnessGain ?: 1f,
            ),
        )
    }

    private fun grayscaleBitmap(): Bitmap {
        for (sourceY in 0 until binnedHeight) {
            for (sourceX in 0 until binnedWidth) {
                val value = mappedLuma[sourceY * binnedWidth + sourceX].toInt() and 0xff
                val colour = 0xff000000.toInt() or (value shl 16) or (value shl 8) or value
                val destinationIndex =
                    rotatedPixelIndex(
                        sourceX = sourceX,
                        sourceY = sourceY,
                        sourceWidth = binnedWidth,
                        sourceHeight = binnedHeight,
                        outputWidth = outputWidth,
                        outputHeight = outputHeight,
                        rotationDegrees = normalizedRotation,
                    )
                outputPixels[destinationIndex] = colour
            }
        }
        val bitmap = outputBitmaps[nextOutputBitmapIndex]
        nextOutputBitmapIndex = (nextOutputBitmapIndex + 1) % outputBitmaps.size
        bitmap.setPixels(outputPixels, 0, outputWidth, 0, 0, outputWidth, outputHeight)
        return bitmap
    }

    private companion object {
        const val OUTPUT_BITMAP_COUNT = 2
    }
}

private fun rotatedPixelIndex(
    sourceX: Int,
    sourceY: Int,
    sourceWidth: Int,
    sourceHeight: Int,
    outputWidth: Int,
    outputHeight: Int,
    rotationDegrees: Int,
): Int = when (rotationDegrees) {
    90 -> sourceX * outputWidth + (outputWidth - 1 - sourceY)
    180 -> (outputHeight - 1 - sourceY) * outputWidth + (outputWidth - 1 - sourceX)
    270 -> (outputHeight - 1 - sourceX) * outputWidth + sourceY
    else -> sourceY * sourceWidth + sourceX
}

private const val RAW_BIN_SIZE = 4
private const val RAW_BYTES_PER_PIXEL = 2
private const val CFA_PATTERN_SIZE = 4
private const val TARGET_OUTPUT_LUMA = 96f
private const val MINIMUM_SIGNAL = 1f / 16f
private const val MINIMUM_RAW_GAIN = 1f
private const val MAXIMUM_RAW_GAIN = 64f
