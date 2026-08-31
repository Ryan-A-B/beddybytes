package com.beddybytes.android.ui

internal class AutomaticMonochromeDecider(
    private val darkFramesRequired: Int = 8,
    private val brightFramesRequired: Int = 30,
) {
    private var darkFrames = 0
    private var brightFrames = 0
    private var monochrome = false

    fun update(
        exposureTimeNanoseconds: Long?,
        frameDurationNanoseconds: Long?,
        sensitivityIso: Int?,
        lowLightBoostActive: Boolean,
    ): Boolean {
        val exposureAtFrameCeiling =
            exposureTimeNanoseconds != null &&
                frameDurationNanoseconds != null &&
                exposureTimeNanoseconds >= frameDurationNanoseconds * 9 / 10
        val darkCapture =
            lowLightBoostActive ||
                (exposureTimeNanoseconds != null && exposureTimeNanoseconds >= 100_000_000L) ||
                (
                    exposureTimeNanoseconds != null &&
                        exposureTimeNanoseconds >= 50_000_000L &&
                        sensitivityIso != null &&
                        sensitivityIso >= 1_600
                    ) ||
                (exposureAtFrameCeiling && sensitivityIso != null && sensitivityIso >= 3_200)
        val clearlyBright =
            !lowLightBoostActive &&
                exposureTimeNanoseconds != null &&
                exposureTimeNanoseconds < 33_000_000L &&
                sensitivityIso != null &&
                sensitivityIso < 800

        when {
            darkCapture -> {
                darkFrames++
                brightFrames = 0
            }

            clearlyBright -> {
                brightFrames++
                darkFrames = 0
            }

            else -> {
                darkFrames = 0
                brightFrames = 0
            }
        }
        if (!monochrome && darkFrames >= darkFramesRequired) {
            monochrome = true
        } else if (monochrome && brightFrames >= brightFramesRequired) {
            monochrome = false
        }
        return monochrome
    }
}
