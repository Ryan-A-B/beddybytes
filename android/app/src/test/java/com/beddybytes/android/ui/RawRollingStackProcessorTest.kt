package com.beddybytes.android.ui

import java.nio.ByteBuffer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RawRollingStackProcessorTest {
    @Test
    fun `raw binner subtracts the four black levels and uses every photosite`() {
        val width = 4
        val height = 4
        val bufferOffset = 7
        val rowStride = width * 2 + 3
        val buffer = ByteBuffer.allocate(bufferOffset + rowStride * height).apply {
            position(bufferOffset)
        }
        val blackLevels = intArrayOf(10, 20, 30, 40)
        for (y in 0 until height) {
            for (x in 0 until width) {
                val rawValue = blackLevels[(y and 1) * 2 + (x and 1)] + 5
                val index = bufferOffset + y * rowStride + x * 2
                buffer.put(index, (rawValue and 0xff).toByte())
                buffer.put(index + 1, (rawValue shr 8).toByte())
            }
        }
        val destination = IntArray(1)

        binRawSensorFrame(
            buffer = buffer,
            width = width,
            height = height,
            rowStride = rowStride,
            pixelStride = 2,
            blackLevels = blackLevels,
            destination = destination,
        )

        assertEquals(16 * 5, destination.single())
    }

    @Test
    fun `raw rolling window evicts its oldest binned frame`() {
        val averager = RollingRawSignalAverager(pixelCount = 1, capacity = 2)
        val sums = IntArray(1)

        assertFalse(averager.add(intArrayOf(10)))
        assertTrue(averager.add(intArrayOf(20)))
        averager.writeSums(sums)
        assertEquals(30, sums.single())

        assertTrue(averager.add(intArrayOf(30)))
        averager.writeSums(sums)
        assertEquals(50, sums.single())
    }

    @Test
    fun `tone mapper preserves sub eight bit raw signal before lift`() {
        val destination = ByteArray(4)
        val gain =
            RawSignalToneMapper().apply(
                sourceSums = IntArray(4) { 8 * 16 * 2 },
                destination = destination,
            )

        assertEquals(48f, gain, 0.001f)
        assertTrue(destination.all { (it.toInt() and 0xff) == 96 })
    }

    @Test
    fun `captured S22 percentile signals produce measured gains`() {
        assertEquals(51.2f, rawBrightnessGain(percentileBlockSignal = 30), 0.01f)
        assertEquals(13.84f, rawBrightnessGain(percentileBlockSignal = 111), 0.01f)
    }
}
