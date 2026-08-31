package com.beddybytes.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class CameraImageCaptureWriterTest {
    @Test
    fun `gain bands progress from one through four`() {
        assertEquals(1, brightnessGainBand(1f))
        assertEquals(1, brightnessGainBand(1.99f))
        assertEquals(2, brightnessGainBand(2f))
        assertEquals(3, brightnessGainBand(3.75f))
        assertEquals(4, brightnessGainBand(4f))
    }

    @Test
    fun `gain bands clamp unexpected values`() {
        assertEquals(1, brightnessGainBand(0f))
        assertEquals(4, brightnessGainBand(10f))
    }
}
