package com.beddybytes.android.ui

import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureResult
import android.os.Build
import android.util.Range

data class CameraTelemetry(
    val cameraId: String,
    val sensorTimestampNanoseconds: Long,
    val width: Int?,
    val height: Int?,
    val exposureTimeNanoseconds: Long?,
    val frameDurationNanoseconds: Long?,
    val sensitivityIso: Int?,
    val framesPerSecond: Double?,
    val availableFrameRateRanges: List<Range<Int>>,
    val requestedFrameRateRange: Range<Int>?,
    val appliedFrameRateRange: Range<Int>?,
    val sensorExposureTimeRangeNanoseconds: Range<Long>?,
    val targetPhysicalCameraId: String?,
    val activePhysicalCameraId: String?,
    val focalLengthMillimetres: Float?,
    val zoomRatio: Float?,
    val aeState: Int?,
    val lowLightBoostSupported: Boolean,
    val lowLightBoostActive: Boolean,
    val exposureControlMode: ExposureControlMode,
    val requestedExposureTimeNanoseconds: Long?,
    val requestedSensitivityIso: Int?,
    val automaticMonochrome: Boolean,
    val rollingStackFrameCount: Int,
    val rollingStackBrightnessGain: Float?,
)

enum class ExposureControlMode(val label: String) {
    AUTO("Auto"),
    ISO_PRIORITY("ISO priority"),
    MANUAL_LOW_LIGHT("Manual low light"),
    AUTO_PROBE("Auto probe"),
}

internal fun preferredLowLightExposureMode(
    manualSensorSupported: Boolean,
    isoPrioritySupported: Boolean,
): ExposureControlMode? = when {
    manualSensorSupported -> ExposureControlMode.MANUAL_LOW_LIGHT
    isoPrioritySupported -> ExposureControlMode.ISO_PRIORITY
    else -> null
}

internal data class CameraCaptureConfiguration(
    val availableFrameRateRanges: List<Range<Int>>,
    val requestedFrameRateRange: Range<Int>?,
    val sensorExposureTimeRangeNanoseconds: Range<Long>?,
    val sensorSensitivityRange: Range<Int>?,
    val maxFrameDurationNanoseconds: Long?,
    val maxAnalogSensitivityIso: Int?,
    val availableAePriorityModes: Set<Int>,
    val manualSensorSupported: Boolean,
    val lowLightBoostSupported: Boolean,
    val highQualityNoiseReductionSupported: Boolean,
) {
    val isoPrioritySupported: Boolean
        get() =
            Build.VERSION.SDK_INT >= 36 &&
                availableAePriorityModes.contains(
                    CameraMetadata.CONTROL_AE_PRIORITY_MODE_SENSOR_SENSITIVITY_PRIORITY,
                )

    companion object {
        fun from(characteristics: CameraCharacteristics): CameraCaptureConfiguration {
            val ranges =
                (
                    characteristics
                        .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
                        ?: emptyArray()
                    )
                    .sortedWith(compareBy<Range<Int>> { it.lower }.thenBy { it.upper })
            val requestedRange =
                ranges
                    .filter { it.upper in 24..30 }
                    .sortedWith(compareByDescending<Range<Int>> { it.upper }.thenBy { it.lower })
                    .firstOrNull()
            val capabilities =
                characteristics
                    .get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
                    ?: intArrayOf()
            val aeModes =
                characteristics.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES)
                    ?: intArrayOf()
            val priorityModes =
                if (Build.VERSION.SDK_INT >= 36) {
                    characteristics
                        .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_PRIORITY_MODES)
                        ?.toSet()
                        ?: emptySet()
                } else {
                    emptySet()
                }
            return CameraCaptureConfiguration(
                availableFrameRateRanges = ranges,
                requestedFrameRateRange = requestedRange,
                sensorExposureTimeRangeNanoseconds =
                    characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE),
                sensorSensitivityRange =
                    characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE),
                maxFrameDurationNanoseconds =
                    characteristics.get(CameraCharacteristics.SENSOR_INFO_MAX_FRAME_DURATION),
                maxAnalogSensitivityIso =
                    characteristics.get(CameraCharacteristics.SENSOR_MAX_ANALOG_SENSITIVITY),
                availableAePriorityModes = priorityModes,
                manualSensorSupported =
                    capabilities.contains(
                        CameraMetadata.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR,
                    ) && aeModes.contains(CameraMetadata.CONTROL_AE_MODE_OFF),
                lowLightBoostSupported =
                    aeModes.contains(
                        CameraMetadata.CONTROL_AE_MODE_ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY,
                    ),
                highQualityNoiseReductionSupported =
                    (
                        characteristics.get(
                            CameraCharacteristics.NOISE_REDUCTION_AVAILABLE_NOISE_REDUCTION_MODES,
                        ) ?: intArrayOf()
                        )
                        .contains(CameraMetadata.NOISE_REDUCTION_MODE_HIGH_QUALITY),
            )
        }
    }
}

internal class LowLightTelemetryTracker(
    private val cameraId: String,
    private val captureConfiguration: CameraCaptureConfiguration,
    private val resolutionProvider: () -> Pair<Int, Int>?,
    private val targetPhysicalCameraId: String?,
    private val rollingStackFrameCountProvider: () -> Int,
    private val rollingStackBrightnessGainProvider: () -> Float?,
) {
    private var previousTimestampNanoseconds: Long? = null
    private var smoothedFramesPerSecond: Double? = null
    private var lastEmissionTimestampNanoseconds = 0L
    private val monochromeDecider = AutomaticMonochromeDecider()

    @Synchronized
    fun onCapture(
        result: CaptureResult,
        exposureControlState: ExposureControlState,
        activePhysicalCameraId: String?,
    ): CameraTelemetry? {
        val timestamp = result.get(CaptureResult.SENSOR_TIMESTAMP) ?: return null
        val exposureTime = result.get(CaptureResult.SENSOR_EXPOSURE_TIME)
        val sensitivity = result.get(CaptureResult.SENSOR_SENSITIVITY)
        val frameDuration = result.get(CaptureResult.SENSOR_FRAME_DURATION)
        previousTimestampNanoseconds?.let { previous ->
            val interval = timestamp - previous
            if (interval > 0) {
                val instantaneous = 1_000_000_000.0 / interval
                smoothedFramesPerSecond =
                    smoothedFramesPerSecond?.let { current -> current * 0.8 + instantaneous * 0.2 }
                        ?: instantaneous
            }
        }
        previousTimestampNanoseconds = timestamp
        val lowLightBoostActive =
            result.get(CaptureResult.CONTROL_AE_MODE) ==
                CameraMetadata.CONTROL_AE_MODE_ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY
        val automaticMonochrome =
            monochromeDecider.update(
                exposureTimeNanoseconds = exposureTime,
                frameDurationNanoseconds = frameDuration,
                sensitivityIso = sensitivity,
                lowLightBoostActive = lowLightBoostActive,
            )

        if (timestamp - lastEmissionTimestampNanoseconds < TELEMETRY_INTERVAL_NANOSECONDS) {
            return null
        }
        lastEmissionTimestampNanoseconds = timestamp
        val resolution = resolutionProvider()
        return CameraTelemetry(
            cameraId = cameraId,
            sensorTimestampNanoseconds = timestamp,
            width = resolution?.first,
            height = resolution?.second,
            exposureTimeNanoseconds = exposureTime,
            frameDurationNanoseconds = frameDuration,
            sensitivityIso = sensitivity,
            framesPerSecond = smoothedFramesPerSecond,
            availableFrameRateRanges = captureConfiguration.availableFrameRateRanges,
            requestedFrameRateRange = captureConfiguration.requestedFrameRateRange,
            appliedFrameRateRange = result.get(CaptureResult.CONTROL_AE_TARGET_FPS_RANGE),
            sensorExposureTimeRangeNanoseconds =
                captureConfiguration.sensorExposureTimeRangeNanoseconds,
            targetPhysicalCameraId = targetPhysicalCameraId,
            activePhysicalCameraId = activePhysicalCameraId,
            focalLengthMillimetres = result.get(CaptureResult.LENS_FOCAL_LENGTH),
            zoomRatio = result.get(CaptureResult.CONTROL_ZOOM_RATIO),
            aeState = result.get(CaptureResult.CONTROL_AE_STATE),
            lowLightBoostSupported = captureConfiguration.lowLightBoostSupported,
            lowLightBoostActive = lowLightBoostActive,
            exposureControlMode = exposureControlState.mode,
            requestedExposureTimeNanoseconds =
                exposureControlState.requestedExposureTimeNanoseconds,
            requestedSensitivityIso = exposureControlState.requestedSensitivityIso,
            automaticMonochrome = automaticMonochrome,
            rollingStackFrameCount = rollingStackFrameCountProvider(),
            rollingStackBrightnessGain = rollingStackBrightnessGainProvider(),
        )
    }

    private companion object {
        const val TELEMETRY_INTERVAL_NANOSECONDS = 250_000_000L
    }
}

internal data class ExposureControlState(
    val mode: ExposureControlMode,
    val requestedExposureTimeNanoseconds: Long? = null,
    val requestedSensitivityIso: Int? = null,
)
