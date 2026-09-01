package com.beddybytes.android.babystation

import android.graphics.Bitmap
import android.media.Image
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.beddybytes.android.mqtt.BabyStationSessionController
import com.beddybytes.android.mqtt.BabyStationSessionState
import com.beddybytes.android.mqtt.BabyStationStartRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class BabyStationViewModel(
    private val preferences: BabyStationSettingsStore,
    deviceCatalog: DeviceCatalog,
    private val session: BabyStationSessionController,
) : ViewModel() {
    private val cameras = deviceCatalog.cameras()
    private val microphones = deviceCatalog.microphones()
    private val mutableUiState =
        MutableStateFlow(
            BabyStationUiState(
                cameras = cameras,
                microphones = microphones,
                selectedCameraId = cameras.firstOrNull()?.id,
                selectedMicrophoneId = microphones.firstOrNull()?.id,
            ),
        )

    val uiState: StateFlow<BabyStationUiState> = mutableUiState.asStateFlow()

    init {
        viewModelScope.launch {
            preferences.settings.collect { settings ->
                mutableUiState.update { current ->
                    current.copy(
                        name = settings.name,
                        selectedCameraId =
                            settings.cameraId.takeIf { saved ->
                                cameras.any { it.id == saved }
                            } ?: cameras.firstOrNull()?.id,
                        selectedMicrophoneId =
                            settings.microphoneId.takeIf { saved ->
                                microphones.any { it.id == saved }
                            } ?: microphones.firstOrNull()?.id,
                    )
                }
            }
        }
        viewModelScope.launch {
            session.state.collect { sessionState ->
                mutableUiState.update { current ->
                    current.copy(
                        running = sessionState.running,
                        active = sessionState is BabyStationSessionState.Active,
                        connectionMessage = sessionState.message,
                    )
                }
            }
        }
    }

    fun onNameChanged(name: String) {
        mutableUiState.update { it.copy(name = name) }
        viewModelScope.launch { preferences.setName(name) }
    }

    fun onCameraSelected(cameraId: String) {
        check(!uiState.value.running)
        mutableUiState.update { it.copy(selectedCameraId = cameraId) }
        viewModelScope.launch { preferences.setCameraId(cameraId) }
    }

    fun onMicrophoneSelected(microphoneId: Int) {
        check(!uiState.value.running)
        mutableUiState.update { it.copy(selectedMicrophoneId = microphoneId) }
        viewModelScope.launch { preferences.setMicrophoneId(microphoneId) }
    }

    fun start() {
        if (uiState.value.running) return
        val state = uiState.value
        session.start(
            BabyStationStartRequest(
                name = state.name,
                cameraId = state.selectedCameraId,
                microphoneId = state.selectedMicrophoneId,
            ),
        )
    }

    fun onCameraFrame(image: Image, rotationDegrees: Int) {
        session.onCameraFrame(image, rotationDegrees)
    }

    fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long) {
        session.onProcessedCameraFrame(bitmap, timestampNanoseconds)
    }

    fun stop() {
        session.stop()
    }

    class Factory(
        private val preferences: BabyStationSettingsStore,
        private val deviceCatalog: DeviceCatalog,
        private val session: BabyStationSessionController,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(BabyStationViewModel::class.java))
            return BabyStationViewModel(preferences, deviceCatalog, session) as T
        }
    }
}

private val BabyStationSessionState.running: Boolean
    get() = when (this) {
        BabyStationSessionState.Ready,
        is BabyStationSessionState.Failed,
        -> false

        BabyStationSessionState.Connecting,
        is BabyStationSessionState.Active,
        BabyStationSessionState.Reconnecting,
        BabyStationSessionState.Stopping,
        -> true
    }

private val BabyStationSessionState.message: String?
    get() = when (this) {
        BabyStationSessionState.Ready,
        is BabyStationSessionState.Active,
        -> null

        BabyStationSessionState.Connecting -> "Connecting…"

        BabyStationSessionState.Reconnecting -> "Connection lost. Reconnecting…"

        BabyStationSessionState.Stopping -> "Stopping…"

        is BabyStationSessionState.Failed -> message
    }
