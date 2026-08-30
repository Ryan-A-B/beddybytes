package com.beddybytes.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.beddybytes.android.authorization.SignInViewModel
import com.beddybytes.android.ui.BeddyBytesApp
import com.beddybytes.android.ui.theme.BeddyBytesTheme

class MainActivity : ComponentActivity() {
    private val beddyBytesApplication: BeddyBytesApplication
        get() = application as BeddyBytesApplication

    private val signInViewModel: SignInViewModel by viewModels {
        SignInViewModel.Factory(beddyBytesApplication.container.authorizationSession)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BeddyBytesTheme {
                val uiState = signInViewModel.uiState.collectAsStateWithLifecycle().value
                BeddyBytesApp(
                    uiState = uiState,
                    onEmailChanged = signInViewModel::onEmailChanged,
                    onPasswordChanged = signInViewModel::onPasswordChanged,
                    onPasswordVisibilityChanged = signInViewModel::onPasswordVisibilityChanged,
                    onSignIn = signInViewModel::signIn,
                    onSignOut = signInViewModel::signOut,
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        beddyBytesApplication.container.authorizationSession.onAppForeground()
    }
}
