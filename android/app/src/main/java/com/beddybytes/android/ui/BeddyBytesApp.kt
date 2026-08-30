package com.beddybytes.android.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.beddybytes.android.authorization.AuthorizationState
import com.beddybytes.android.authorization.SignInFailure
import com.beddybytes.android.authorization.SignInUiState

@Suppress("FunctionName")
@Composable
fun BeddyBytesApp(
    uiState: SignInUiState,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onPasswordVisibilityChanged: () -> Unit,
    onSignIn: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(modifier = modifier.fillMaxSize()) {
        when (val authorization = uiState.authorization) {
            AuthorizationState.RestoringSession ->
                SessionProgressScreen(message = "Restoring session…", onSignOut = onSignOut)

            is AuthorizationState.SignedOut,
            is AuthorizationState.SigningIn,
            ->
                SignInScreen(
                    uiState = uiState,
                    onEmailChanged = onEmailChanged,
                    onPasswordChanged = onPasswordChanged,
                    onPasswordVisibilityChanged = onPasswordVisibilityChanged,
                    onSignIn = onSignIn,
                )

            is AuthorizationState.Authorized ->
                BabyStationStatusScreen(
                    email = authorization.account.email,
                    status = "Ready",
                    onSignOut = onSignOut,
                )

            is AuthorizationState.Refreshing ->
                BabyStationStatusScreen(
                    email = authorization.account.email,
                    status = "Refreshing session…",
                    onSignOut = onSignOut,
                )

            is AuthorizationState.Unavailable ->
                if (authorization.account == null) {
                    SessionProgressScreen(
                        message = "Can't connect. Retrying…",
                        onSignOut = onSignOut,
                    )
                } else {
                    BabyStationStatusScreen(
                        email = authorization.account.email,
                        status = "Connection unavailable. Retrying…",
                        onSignOut = onSignOut,
                    )
                }
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun SignInScreen(
    uiState: SignInUiState,
    onEmailChanged: (String) -> Unit,
    onPasswordChanged: (String) -> Unit,
    onPasswordVisibilityChanged: () -> Unit,
    onSignIn: () -> Unit,
) {
    val signingIn = uiState.authorization is AuthorizationState.SigningIn
    val failure = (uiState.authorization as? AuthorizationState.SignedOut)?.reason

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
            value = uiState.email,
            onValueChange = onEmailChanged,
            enabled = !signingIn,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
        )
        OutlinedTextField(
            value = uiState.password,
            onValueChange = onPasswordChanged,
            enabled = !signingIn,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
            label = { Text("Password") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            trailingIcon = {
                TextButton(
                    onClick = onPasswordVisibilityChanged,
                    enabled = !signingIn,
                ) {
                    Text(if (uiState.passwordVisible) "Hide" else "Show")
                }
            },
            visualTransformation =
                if (uiState.passwordVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
            singleLine = true,
        )
        failure?.let {
            Text(
                text = it.message(),
                modifier = Modifier.padding(top = 16.dp),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        Button(
            onClick = onSignIn,
            enabled = !signingIn && uiState.email.isNotBlank() && uiState.password.isNotBlank(),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 24.dp),
        ) {
            Text(if (signingIn) "Signing in…" else "Sign in")
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun SessionProgressScreen(message: String, onSignOut: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircularProgressIndicator()
        Text(
            text = message,
            modifier = Modifier.padding(top = 20.dp),
            style = MaterialTheme.typography.bodyLarge,
        )
        TextButton(
            onClick = onSignOut,
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text("Sign out")
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun BabyStationStatusScreen(email: String, status: String, onSignOut: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = "Baby Station", style = MaterialTheme.typography.headlineLarge)
        Text(
            text = status,
            modifier = Modifier.padding(top = 12.dp),
            style = MaterialTheme.typography.bodyLarge,
        )
        Text(
            text = email,
            modifier = Modifier.padding(top = 8.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
        TextButton(
            onClick = onSignOut,
            modifier = Modifier.padding(top = 20.dp),
        ) {
            Text("Sign out")
        }
    }
}

private fun SignInFailure.message(): String = when (this) {
    SignInFailure.INVALID_CREDENTIALS -> "The email or password is incorrect."
    SignInFailure.CONNECTION -> "Couldn't connect. Check your connection and try again."
}
