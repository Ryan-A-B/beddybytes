package com.beddybytes.android.authorization

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class SignInUiState(
    val authorization: AuthorizationState = AuthorizationState.SignedOut(),
    val email: String = "",
    val password: String = "",
    val passwordVisible: Boolean = false,
)

class SignInViewModel(private val authorizationSession: AuthorizationSession) : ViewModel() {
    private val formState = MutableStateFlow(SignInFormState())
    private var signInJob: Job? = null

    val uiState: StateFlow<SignInUiState> =
        combine(authorizationSession.state, formState) { authorization, form ->
            SignInUiState(
                authorization = authorization,
                email = form.email,
                password = form.password,
                passwordVisible = form.passwordVisible,
            )
        }.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = SignInUiState(authorization = authorizationSession.state.value),
        )

    fun onEmailChanged(email: String) {
        formState.value = formState.value.copy(email = email)
    }

    fun onPasswordChanged(password: String) {
        formState.value = formState.value.copy(password = password)
    }

    fun onPasswordVisibilityChanged() {
        formState.value = formState.value.copy(passwordVisible = !formState.value.passwordVisible)
    }

    fun signIn() {
        if (signInJob?.isActive == true) return
        val form = formState.value
        if (form.email.isBlank() || form.password.isBlank()) return
        signInJob =
            viewModelScope.launch {
                try {
                    authorizationSession.signIn(form.email.trim(), form.password)
                } finally {
                    formState.value = formState.value.copy(password = "", passwordVisible = false)
                }
            }
    }

    fun signOut() {
        viewModelScope.launch { authorizationSession.signOut() }
    }

    private data class SignInFormState(
        val email: String = "",
        val password: String = "",
        val passwordVisible: Boolean = false,
    )

    class Factory(private val authorizationSession: AuthorizationSession) :
        ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(SignInViewModel::class.java))
            return SignInViewModel(authorizationSession) as T
        }
    }
}
