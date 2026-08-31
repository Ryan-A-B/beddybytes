package com.beddybytes.android.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class LowLightExposureModeTest {
    @Test
    fun `proven logical camera request retains readout headroom`() {
        val plan =
            manualExposurePlan(
                maximumExposureNanoseconds = 103_388_880L,
                maximumSensitivityIso = 3_200,
                lowestAdvertisedFramesPerSecond = 7,
                maximumFrameDurationNanoseconds = 1_000_000_000L,
            )!!

        assertEquals(103_388_880L, plan.exposureNanoseconds)
        assertEquals(153_388_880L, plan.frameDurationNanoseconds)
    }

    @Test
    fun `s22 physical exposure leaves sensor readout time in the frame`() {
        val plan =
            manualExposurePlan(
                maximumExposureNanoseconds = 164_064_000L,
                maximumSensitivityIso = 3_200,
                lowestAdvertisedFramesPerSecond = 7,
                maximumFrameDurationNanoseconds = 1_000_000_000L,
            )!!

        assertEquals(164_064_000L, plan.exposureNanoseconds)
        assertEquals(214_064_000L, plan.frameDurationNanoseconds)
        assertEquals(3_200, plan.sensitivityIso)
    }

    @Test
    fun `exposure remains inside a restrictive maximum frame duration`() {
        val plan =
            manualExposurePlan(
                maximumExposureNanoseconds = 164_064_000L,
                maximumSensitivityIso = 3_200,
                lowestAdvertisedFramesPerSecond = 7,
                maximumFrameDurationNanoseconds = 150_000_000L,
            )!!

        assertEquals(149_000_000L, plan.exposureNanoseconds)
        assertEquals(150_000_000L, plan.frameDurationNanoseconds)
    }

    @Test
    fun `manual sensor control takes priority over automatic iso priority`() {
        assertEquals(
            ExposureControlMode.MANUAL_LOW_LIGHT,
            preferredLowLightExposureMode(
                manualSensorSupported = true,
                isoPrioritySupported = true,
            ),
        )
    }

    @Test
    fun `iso priority is retained as a fallback`() {
        assertEquals(
            ExposureControlMode.ISO_PRIORITY,
            preferredLowLightExposureMode(
                manualSensorSupported = false,
                isoPrioritySupported = true,
            ),
        )
    }

    @Test
    fun `unsupported cameras stay automatic`() {
        assertEquals(
            null,
            preferredLowLightExposureMode(
                manualSensorSupported = false,
                isoPrioritySupported = false,
            ),
        )
    }
}
