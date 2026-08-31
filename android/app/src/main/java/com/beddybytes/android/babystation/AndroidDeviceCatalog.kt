package com.beddybytes.android.babystation

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.media.AudioDeviceInfo
import android.media.AudioManager

class AndroidDeviceCatalog(context: Context) : DeviceCatalog {
    private val cameraManager = context.getSystemService(CameraManager::class.java)
    private val audioManager = context.getSystemService(AudioManager::class.java)

    override fun cameras(): List<CameraOption> {
        val lensCounts = mutableMapOf<Int?, Int>()
        val cameras =
            runCatching { cameraManager.cameraIdList }
                .getOrDefault(emptyArray())
                .map { cameraId ->
                    val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                    val lensFacing = characteristics.get(CameraCharacteristics.LENS_FACING)
                    val ordinal = (lensCounts[lensFacing] ?: 0) + 1
                    lensCounts[lensFacing] = ordinal
                    CameraDetails(
                        option =
                            CameraOption(
                                id = cameraId,
                                label = cameraLabel(lensFacing, ordinal),
                            ),
                        lensFacing = lensFacing,
                        lowLightScore = lowLightScore(characteristics, lensFacing),
                    )
                }
        val preferredCameraId =
            cameras
                .filter { it.lensFacing == CameraCharacteristics.LENS_FACING_BACK }
                .maxByOrNull { it.lowLightScore ?: Double.NEGATIVE_INFINITY }
                ?.takeIf { it.lowLightScore != null }
                ?.option
                ?.id

        return cameras.map { details ->
            details.option.copy(preferredForLowLight = details.option.id == preferredCameraId)
        }.sortedBy { option ->
            when {
                option.label.startsWith("Back") -> 0
                option.label.startsWith("Front") -> 1
                else -> 2
            }
        }
    }

    private fun lowLightScore(characteristics: CameraCharacteristics, lensFacing: Int?): Double? {
        if (lensFacing != CameraCharacteristics.LENS_FACING_BACK) return null

        val sensorSize =
            characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: return null
        val widestAperture =
            characteristics
                .get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
                ?.minOrNull()
                ?: return null
        if (widestAperture <= 0f) return null

        val supportsLowLightBoost =
            characteristics
                .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_MODES)
                ?.contains(CameraMetadata.CONTROL_AE_MODE_ON_LOW_LIGHT_BOOST_BRIGHTNESS_PRIORITY)
                ?: false
        val lowLightBoostFactor = if (supportsLowLightBoost) 1.1 else 1.0
        return sensorSize.width * sensorSize.height / (widestAperture * widestAperture) *
            lowLightBoostFactor
    }

    override fun microphones(): List<MicrophoneOption> = runCatching {
        audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS)
    }.getOrDefault(emptyArray())
        .map { device ->
            MicrophoneOption(
                id = device.id,
                label = microphoneLabel(device),
            )
        }.sortedBy { if (it.label == "Built-in microphone") 0 else 1 }

    private fun cameraLabel(lensFacing: Int?, ordinal: Int): String {
        val base =
            when (lensFacing) {
                CameraCharacteristics.LENS_FACING_BACK -> "Back camera"
                CameraCharacteristics.LENS_FACING_FRONT -> "Front camera"
                CameraCharacteristics.LENS_FACING_EXTERNAL -> "External camera"
                else -> "Camera"
            }
        return if (ordinal == 1) base else "$base $ordinal"
    }

    private fun microphoneLabel(device: AudioDeviceInfo): String = when (device.type) {
        AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Built-in microphone"

        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> device.productName.toString()

        AudioDeviceInfo.TYPE_USB_DEVICE,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        -> device.productName.toString()

        else -> device.productName.toString().ifBlank { "Microphone" }
    }

    private data class CameraDetails(
        val option: CameraOption,
        val lensFacing: Int?,
        val lowLightScore: Double?,
    )
}
