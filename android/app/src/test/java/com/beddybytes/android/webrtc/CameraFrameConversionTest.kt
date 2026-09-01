package com.beddybytes.android.webrtc

import java.nio.ByteBuffer
import org.junit.Assert.assertArrayEquals
import org.junit.Test

class CameraFrameConversionTest {
    @Test
    fun `copies padded rows into a tightly packed plane`() {
        val source = ByteBuffer.wrap(byteArrayOf(1, 2, 3, 99, 4, 5, 6, 99))
        val destination = ByteBuffer.allocate(6)

        copyStridedPlane(source, 3, 2, 4, 1, destination, 3)

        assertArrayEquals(byteArrayOf(1, 2, 3, 4, 5, 6), destination.array())
    }

    @Test
    fun `deinterleaves chroma and respects source position and destination padding`() {
        val source = ByteBuffer.wrap(byteArrayOf(99, 10, 20, 11, 21, 0, 12, 22, 13, 23))
        source.position(1)
        val destination = ByteBuffer.allocate(6)

        copyStridedPlane(source, 2, 2, 5, 2, destination, 3)

        assertArrayEquals(byteArrayOf(10, 11, 0, 12, 13, 0), destination.array())
    }
}
