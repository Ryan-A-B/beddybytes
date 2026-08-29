package com.beddybytes.android

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.net.toUri
import com.beddybytes.android.domain.BabyStationState
import com.beddybytes.android.infrastructure.AppEnvironment
import com.beddybytes.android.ui.BeddyBytesApp
import com.beddybytes.android.ui.theme.BeddyBytesTheme

class MainActivity : ComponentActivity() {
    private val environment by lazy(AppEnvironment::fromBuildConfig)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BeddyBytesTheme {
                BeddyBytesApp(
                    state = BabyStationState.SignedOut,
                    onSignIn = { _, _ ->
                        Toast.makeText(
                            this,
                            "Sign-in connection arrives in Phase 2",
                            Toast.LENGTH_SHORT,
                        ).show()
                    },
                    onCreateAccount = { openBrowser("/#create_account") },
                    onResetPassword = { openBrowser("/request-password-reset") },
                )
            }
        }
    }

    private fun openBrowser(path: String) {
        val destination = (environment.accountWebUrl + path).toUri()
        startActivity(Intent(Intent.ACTION_VIEW, destination))
    }
}
