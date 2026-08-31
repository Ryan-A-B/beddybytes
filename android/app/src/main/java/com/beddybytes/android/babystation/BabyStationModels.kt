package com.beddybytes.android.babystation

import kotlinx.coroutines.flow.Flow

data class CameraOption(
    val id: String,
    val label: String,
    val preferredForLowLight: Boolean = false,
)

data class MicrophoneOption(val id: Int, val label: String)

data class BabyStationSettings(
    val name: String = "Nursery",
    val cameraId: String? = null,
    val microphoneId: Int? = null,
)

data class BabyStationUiState(
    val name: String = "Nursery",
    val cameras: List<CameraOption> = emptyList(),
    val microphones: List<MicrophoneOption> = emptyList(),
    val selectedCameraId: String? = null,
    val selectedMicrophoneId: Int? = null,
    val running: Boolean = false,
    val active: Boolean = false,
    val connectionMessage: String? = null,
) {
    val selectedCamera: CameraOption?
        get() = cameras.firstOrNull { it.id == selectedCameraId }

    val selectedMicrophone: MicrophoneOption?
        get() = microphones.firstOrNull { it.id == selectedMicrophoneId }
}

interface BabyStationSettingsStore {
    val settings: Flow<BabyStationSettings>

    suspend fun setName(name: String)

    suspend fun setCameraId(cameraId: String)

    suspend fun setMicrophoneId(microphoneId: Int)
}

interface DeviceCatalog {
    fun cameras(): List<CameraOption>

    fun microphones(): List<MicrophoneOption>
}
