package com.beddybytes.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.beddybytes.android.domain.BabyStationState

@Suppress("FunctionName")
@Composable
fun BeddyBytesApp(
    state: BabyStationState,
    onSignIn: (email: String, password: String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize()) {
        when (state) {
            BabyStationState.SignedOut ->
                SignInScreen(
                    onSignIn = onSignIn,
                )

            else -> BabyStationStatusScreen(state)
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun SignInScreen(
    onSignIn: (email: String, password: String) -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var passwordVisible by rememberSaveable { mutableStateOf(false) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 48.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "BeddyBytes",
            modifier = Modifier.padding(bottom = 32.dp),
            style = MaterialTheme.typography.headlineLarge,
        )
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
            label = { Text("Password") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                TextButton(onClick = { passwordVisible = !passwordVisible }) {
                    Text(if (passwordVisible) "Hide" else "Show")
                }
            },
            visualTransformation =
                if (passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
            singleLine = true,
        )
        Button(
            onClick = { onSignIn(email.trim(), password) },
            enabled = email.isNotBlank() && password.isNotBlank(),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
        ) {
            Text("Sign in")
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun BabyStationStatusScreen(state: BabyStationState) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Baby Station",
            style = MaterialTheme.typography.headlineLarge,
        )
        Text(
            text = state.displayName(),
            modifier = Modifier.padding(top = 12.dp),
            style = MaterialTheme.typography.bodyLarge,
        )
    }
}

private fun BabyStationState.displayName(): String = when (this) {
    BabyStationState.SignedOut -> "Signed out"
    BabyStationState.Ready -> "Ready"
    BabyStationState.Starting -> "Starting"
    BabyStationState.Active -> "Active"
    BabyStationState.Reconnecting -> "Reconnecting"
    BabyStationState.Stopping -> "Stopping"
    is BabyStationState.Failed -> "Failed: $message"
}
