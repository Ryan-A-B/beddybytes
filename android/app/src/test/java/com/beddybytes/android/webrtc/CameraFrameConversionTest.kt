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

    @Test
    fun `converts processed grayscale pixels to neutral chroma i420`() {
        val y = ByteBuffer.allocate(8)
        val u = ByteBuffer.allocate(2)
        val v = ByteBuffer.allocate(2)

        copyGrayscaleArgbToI420(
            pixels =
                intArrayOf(
                    0xff0a0a0a.toInt(),
                    0xff141414.toInt(),
                    0xff1e1e1e.toInt(),
                    0xff282828.toInt(),
                    0xff323232.toInt(),
                    0xff3c3c3c.toInt(),
                ),
            width = 3,
            height = 2,
            destinationY = y,
            strideY = 4,
            destinationU = u,
            strideU = 2,
            destinationV = v,
            strideV = 2,
        )

        assertArrayEquals(byteArrayOf(10, 20, 30, 0, 40, 50, 60, 0), y.array())
        assertArrayEquals(byteArrayOf(-128, -128), u.array())
        assertArrayEquals(byteArrayOf(-128, -128), v.array())
    }
}
