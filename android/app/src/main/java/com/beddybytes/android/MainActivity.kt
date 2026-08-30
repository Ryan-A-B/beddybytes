package com.beddybytes.android

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.beddybytes.android.domain.BabyStationState
import com.beddybytes.android.ui.BeddyBytesApp
import com.beddybytes.android.ui.theme.BeddyBytesTheme

class MainActivity : ComponentActivity() {
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
                )
            }
        }
    }
}
