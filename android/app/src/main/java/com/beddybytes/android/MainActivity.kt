package com.beddybytes.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beddybytes.android.authorization.SignInViewModel
import com.beddybytes.android.babystation.BabyStationViewModel
import com.beddybytes.android.ui.BeddyBytesApp
import com.beddybytes.android.ui.theme.BeddyBytesTheme

class MainActivity : ComponentActivity() {
    private val beddyBytesApplication: BeddyBytesApplication
        get() = application as BeddyBytesApplication

    private val signInViewModel: SignInViewModel by viewModels {
        SignInViewModel.Factory(beddyBytesApplication.container.authorizationSession)
    }
    private val babyStationViewModel: BabyStationViewModel by viewModels {
        BabyStationViewModel.Factory(
            preferences = beddyBytesApplication.container.babyStationPreferences,
            deviceCatalog = beddyBytesApplication.container.androidDeviceCatalog,
            session = beddyBytesApplication.container.babyStationMqttSession,
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BeddyBytesTheme {
                val uiState = signInViewModel.uiState.collectAsStateWithLifecycle().value
                val babyStationUiState =
                    babyStationViewModel.uiState.collectAsStateWithLifecycle().value
                BeddyBytesApp(
                    uiState = uiState,
                    babyStationUiState = babyStationUiState,
                    onEmailChanged = signInViewModel::onEmailChanged,
                    onPasswordChanged = signInViewModel::onPasswordChanged,
                    onPasswordVisibilityChanged = signInViewModel::onPasswordVisibilityChanged,
                    onSignIn = signInViewModel::signIn,
                    onSignOut = {
                        babyStationViewModel.stop()
                        signInViewModel.signOut()
                    },
                    onStationNameChanged = babyStationViewModel::onNameChanged,
                    onCameraSelected = babyStationViewModel::onCameraSelected,
                    onMicrophoneSelected = babyStationViewModel::onMicrophoneSelected,
                    onStationStart = babyStationViewModel::start,
                    onStationStop = babyStationViewModel::stop,
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        beddyBytesApplication.container.authorizationSession.onAppForeground()
    }
}
