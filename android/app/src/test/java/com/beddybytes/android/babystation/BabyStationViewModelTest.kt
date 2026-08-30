package com.beddybytes.android.babystation

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BabyStationViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun settingsApplyImmediatelyAndPersist() = runTest(dispatcher) {
        val settings = FakeSettingsStore()
        val viewModel = BabyStationViewModel(settings, FakeDeviceCatalog)
        advanceUntilIdle()

        viewModel.onNameChanged("Cot")
        viewModel.onCameraSelected("front")
        viewModel.onMicrophoneSelected(2)
        advanceUntilIdle()

        assertEquals("Cot", viewModel.uiState.value.name)
        assertEquals("front", viewModel.uiState.value.selectedCameraId)
        assertEquals(2, viewModel.uiState.value.selectedMicrophoneId)
        assertEquals(BabyStationSettings("Cot", "front", 2), settings.settings.value)
    }

    @Test
    fun startAndStopDriveRunningState() = runTest(dispatcher) {
        val viewModel = BabyStationViewModel(FakeSettingsStore(), FakeDeviceCatalog)
        advanceUntilIdle()

        viewModel.start()
        assertTrue(viewModel.uiState.value.running)

        viewModel.stop()
        assertFalse(viewModel.uiState.value.running)
    }

    private class FakeSettingsStore : BabyStationSettingsStore {
        override val settings = MutableStateFlow(BabyStationSettings())

        override suspend fun setName(name: String) {
            settings.value = settings.value.copy(name = name)
        }

        override suspend fun setCameraId(cameraId: String) {
            settings.value = settings.value.copy(cameraId = cameraId)
        }

        override suspend fun setMicrophoneId(microphoneId: Int) {
            settings.value = settings.value.copy(microphoneId = microphoneId)
        }
    }

    private data object FakeDeviceCatalog : DeviceCatalog {
        override fun cameras() = listOf(
            CameraOption("back", "Back camera"),
            CameraOption("front", "Front camera"),
        )

        override fun microphones() = listOf(
            MicrophoneOption(1, "Built-in microphone"),
            MicrophoneOption(2, "USB microphone"),
        )
    }
}
