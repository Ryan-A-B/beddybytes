package com.beddybytes.android.babystation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.beddybytes.android.domain.BabyStationEvent
import com.beddybytes.android.domain.BabyStationState
import com.beddybytes.android.domain.BabyStationStateMachine
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class BabyStationViewModel(
    private val preferences: BabyStationSettingsStore,
    deviceCatalog: DeviceCatalog,
) : ViewModel() {
    private val stateMachine = BabyStationStateMachine(BabyStationState.Ready)
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
        stateMachine.dispatch(BabyStationEvent.StartRequested)
        stateMachine.dispatch(BabyStationEvent.Started)
        mutableUiState.update { it.copy(running = true) }
    }

    fun stop() {
        if (!uiState.value.running) return
        stateMachine.dispatch(BabyStationEvent.StopRequested)
        stateMachine.dispatch(BabyStationEvent.Stopped)
        mutableUiState.update { it.copy(running = false) }
    }

    class Factory(
        private val preferences: BabyStationSettingsStore,
        private val deviceCatalog: DeviceCatalog,
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(BabyStationViewModel::class.java))
            return BabyStationViewModel(preferences, deviceCatalog) as T
        }
    }
}
