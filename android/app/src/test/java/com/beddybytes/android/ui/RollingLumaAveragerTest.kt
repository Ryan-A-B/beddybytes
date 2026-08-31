package com.beddybytes.android.ui

import java.nio.ByteBuffer
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RollingLumaAveragerTest {
    @Test
    fun `emits only after the window is full`() {
        val averager = RollingLumaAverager(width = 2, height = 1, capacity = 3)

        assertFalse(averager.add(bytes(0, 30)))
        assertFalse(averager.add(bytes(30, 60)))
        assertTrue(averager.add(bytes(60, 90)))
        val output = ByteArray(2)
        averager.writeAverage(output)
        assertArrayEquals(bytes(30, 60), output)
        assertEquals(3, averager.frameCount)
    }

    @Test
    fun `new frame pushes the oldest frame out`() {
        val averager = RollingLumaAverager(width = 1, height = 1, capacity = 3)
        averager.add(bytes(0))
        averager.add(bytes(30))
        averager.add(bytes(60))

        assertTrue(averager.add(bytes(90)))
        val output = ByteArray(1)
        averager.writeAverage(output)
        assertArrayEquals(bytes(60), output)
    }

    @Test
    fun `unsigned luma values do not overflow`() {
        val averager = RollingLumaAverager(width = 1, height = 1, capacity = 2)
        averager.add(bytes(240))

        averager.add(bytes(250))
        val output = ByteArray(1)
        averager.writeAverage(output)
        assertArrayEquals(bytes(245), output)
    }

    @Test
    fun `full resolution rolling updates reuse caller owned output`() {
        val averager = RollingLumaAverager(width = 16, height = 9, capacity = 8)
        val input = ByteArray(16 * 9)
        val output = ByteArray(16 * 9)

        repeat(40) { frame ->
            input.fill(frame.toByte())
            if (averager.add(input)) {
                averager.writeAverage(output)
            }
        }

        assertEquals(8, averager.frameCount)
        assertTrue(output.all { (it.toInt() and 0xff) == 35 })
    }

    @Test
    fun `samsung style plane offset and row padding are respected`() {
        val buffer =
            ByteBuffer.wrap(
                bytes(
                    99,
                    99,
                    10,
                    20,
                    30,
                    99,
                    40,
                    50,
                    60,
                ),
            )
        buffer.position(2)
        val output = ByteArray(6)

        copyStridedLuma(
            buffer = buffer,
            width = 3,
            height = 2,
            rowStride = 4,
            pixelStride = 1,
            destination = output,
        )

        assertArrayEquals(bytes(10, 20, 30, 40, 50, 60), output)
    }

    private fun bytes(vararg values: Int): ByteArray =
        ByteArray(values.size) { index -> values[index].toByte() }
}
