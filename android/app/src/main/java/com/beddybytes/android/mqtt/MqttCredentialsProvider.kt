package com.beddybytes.android.mqtt

import com.beddybytes.android.authorization.AuthenticationRequiredException
import com.beddybytes.android.authorization.AuthorizationSession
import com.beddybytes.android.authorization.AuthorizationState

internal data class MqttCredentials(val accountId: String, val accessToken: String)

internal fun interface MqttCredentialsProvider {
    suspend fun credentials(): MqttCredentials
}

internal class AuthorizationMqttCredentialsProvider(
    private val authorizationSession: AuthorizationSession,
) : MqttCredentialsProvider {
    override suspend fun credentials(): MqttCredentials {
        val accountId = authorizationSession.state.value.accountIdOrNull()
            ?: throw AuthenticationRequiredException()
        return MqttCredentials(
            accountId = accountId,
            accessToken = authorizationSession.getAccessToken(),
        )
    }
}

private fun AuthorizationState.accountIdOrNull(): String? = when (this) {
    is AuthorizationState.Authorized -> account.id

    is AuthorizationState.Refreshing -> account.id

    is AuthorizationState.Unavailable -> account?.id

    AuthorizationState.RestoringSession,
    is AuthorizationState.SignedOut,
    is AuthorizationState.SigningIn,
    -> null
}
