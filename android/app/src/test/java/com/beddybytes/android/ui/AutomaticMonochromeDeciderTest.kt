package com.beddybytes.android.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AutomaticMonochromeDeciderTest {
    @Test
    fun `switches to monochrome when exposure is pinned at high ISO`() {
        val decider = AutomaticMonochromeDecider()

        repeat(7) {
            assertFalse(decider.update(DARK_EXPOSURE, DARK_FRAME_DURATION, 11_671, false))
        }

        assertTrue(decider.update(DARK_EXPOSURE, DARK_FRAME_DURATION, 11_671, false))
    }

    @Test
    fun `returns to colour only after sustained bright captures`() {
        val decider = AutomaticMonochromeDecider(darkFramesRequired = 1, brightFramesRequired = 3)
        assertTrue(decider.update(DARK_EXPOSURE, DARK_FRAME_DURATION, 11_671, false))

        repeat(2) {
            assertTrue(decider.update(10_000_000L, 33_333_333L, 400, false))
        }

        assertFalse(decider.update(10_000_000L, 33_333_333L, 400, false))
    }

    private companion object {
        const val DARK_EXPOSURE = 41_600_000L
        const val DARK_FRAME_DURATION = 41_666_667L
    }
}
