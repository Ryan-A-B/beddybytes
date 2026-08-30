package com.beddybytes.android.babystation

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioDeviceInfo
import android.media.AudioManager

class AndroidDeviceCatalog(context: Context) : DeviceCatalog {
    private val cameraManager = context.getSystemService(CameraManager::class.java)
    private val audioManager = context.getSystemService(AudioManager::class.java)

    override fun cameras(): List<CameraOption> {
        val lensCounts = mutableMapOf<Int?, Int>()
        return runCatching { cameraManager.cameraIdList }
            .getOrDefault(emptyArray())
            .map { cameraId ->
                val lensFacing =
                    cameraManager
                        .getCameraCharacteristics(cameraId)
                        .get(CameraCharacteristics.LENS_FACING)
                val ordinal = (lensCounts[lensFacing] ?: 0) + 1
                lensCounts[lensFacing] = ordinal
                CameraOption(
                    id = cameraId,
                    label = cameraLabel(lensFacing, ordinal),
                )
            }.sortedBy { option ->
                when {
                    option.label.startsWith("Back") -> 0
                    option.label.startsWith("Front") -> 1
                    else -> 2
                }
            }
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
}
