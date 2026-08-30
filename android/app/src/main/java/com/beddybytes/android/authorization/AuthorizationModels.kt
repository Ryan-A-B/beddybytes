package com.beddybytes.android.authorization

data class AccountSummary(val id: String, val userId: String, val email: String)

sealed interface AuthorizationState {
    data object RestoringSession : AuthorizationState

    data class SignedOut(val reason: SignInFailure? = null) : AuthorizationState

    data class SigningIn(val email: String) : AuthorizationState

    data class Authorized(val account: AccountSummary) : AuthorizationState

    data class Refreshing(val account: AccountSummary) : AuthorizationState

    data class Unavailable(val account: AccountSummary?) : AuthorizationState
}

enum class SignInFailure {
    INVALID_CREDENTIALS,
    CONNECTION,
}

internal data class AccessGrant(
    val accessToken: String,
    val expiresAtMillis: Long,
    val refreshAtMillis: Long,
)

internal class AuthorizationRejectedException : Exception()

internal class AuthorizationUnavailableException(cause: Throwable? = null) : Exception(cause)

class AuthenticationRequiredException : Exception()
