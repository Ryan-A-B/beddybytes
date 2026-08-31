package com.beddybytes.android.ui

import com.beddybytes.android.authorization.AuthorizationState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DebugAuthorizationBypassTest {
    @Test
    fun `disabled authorization opens the authorized app from signed out state`() {
        assertTrue(
            effectiveAuthorizationState(
                authorization = AuthorizationState.SignedOut(),
                authorizationRequired = false,
            ) is AuthorizationState.Authorized,
        )
    }

    @Test
    fun `required authorization preserves the real state`() {
        val signedOut = AuthorizationState.SignedOut()

        assertEquals(
            signedOut,
            effectiveAuthorizationState(
                authorization = signedOut,
                authorizationRequired = true,
            ),
        )
    }
}
