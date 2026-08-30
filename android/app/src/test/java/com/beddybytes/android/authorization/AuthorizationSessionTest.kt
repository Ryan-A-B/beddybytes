package com.beddybytes.android.authorization

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class AuthorizationSessionTest {
    private val account = AccountSummary("account-id", "user-id", "parent@example.com")

    @Test
    fun signInPublishesAccountWithoutPublishingAccessToken() = runTest {
        val repository = FakeAuthorizationRepository()
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { 0L })

        session.signIn("parent@example.com", "password")

        assertEquals(AuthorizationState.Authorized(account), session.state.value)
        assertTrue(session.state.value.toString().contains("access-token").not())
    }

    @Test
    fun rejectedSignInClearsRefreshSession() = runTest {
        val repository = FakeAuthorizationRepository(signInError = AuthorizationRejectedException())
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { 0L })

        session.signIn("parent@example.com", "wrong")

        assertEquals(
            AuthorizationState.SignedOut(SignInFailure.INVALID_CREDENTIALS),
            session.state.value,
        )
        assertEquals(1, repository.clearCalls)
    }

    @Test
    fun restoresAnExistingSessionAtStartup() = runTest {
        val repository = FakeAuthorizationRepository(hasRefreshSession = true)
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { 0L })

        session.start()
        runCurrent()

        assertEquals(AuthorizationState.Authorized(account), session.state.value)
        assertEquals(1, repository.refreshCalls)
    }

    @Test
    fun concurrentCallersShareOneRotatingRefresh() = runTest {
        val refreshGate = CompletableDeferred<Unit>()
        val repository = FakeAuthorizationRepository(refreshGate = refreshGate)
        var now = 0L
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { now })
        session.signIn("parent@example.com", "password")
        now = 10_000L

        val first = async { session.getAccessToken() }
        val second = async { session.getAccessToken() }
        refreshGate.complete(Unit)

        assertEquals("refreshed-token", first.await())
        assertEquals("refreshed-token", second.await())
        assertEquals(1, repository.refreshCalls)
    }

    @Test
    fun refreshesAutomaticallyBeforeAccessTokenExpiry() = runTest {
        val repository = FakeAuthorizationRepository()
        val session =
            AuthorizationSession(
                repository,
                backgroundScope,
                AuthorizationClock { testScheduler.currentTime },
            )
        session.signIn("parent@example.com", "password")

        advanceTimeBy(5_001L)
        runCurrent()

        assertEquals(1, repository.refreshCalls)
        session.signOut()
    }

    @Test
    fun rejectedRefreshClearsRotatingCookieAndSignsOut() = runTest {
        val repository =
            FakeAuthorizationRepository(refreshError = AuthorizationRejectedException())
        var now = 0L
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { now })
        session.signIn("parent@example.com", "password")
        now = 10_000L

        val result = runCatching { session.getAccessToken() }

        assertTrue(result.exceptionOrNull() is AuthenticationRequiredException)
        assertEquals(AuthorizationState.SignedOut(), session.state.value)
        assertEquals(1, repository.clearCalls)
    }

    @Test
    fun unavailableRefreshRetainsRotatingCookieForRetry() = runTest {
        val repository =
            FakeAuthorizationRepository(refreshError = AuthorizationUnavailableException())
        var now = 0L
        val session = AuthorizationSession(repository, backgroundScope, AuthorizationClock { now })
        session.signIn("parent@example.com", "password")
        now = 10_000L

        val result = runCatching { session.getAccessToken() }

        assertTrue(result.exceptionOrNull() is AuthorizationUnavailableException)
        assertEquals(AuthorizationState.Unavailable(account), session.state.value)
        assertTrue(repository.hasRefreshSession)
        assertEquals(0, repository.clearCalls)
    }

    private inner class FakeAuthorizationRepository(
        var hasRefreshSession: Boolean = false,
        private val signInError: Exception? = null,
        private val refreshGate: CompletableDeferred<Unit>? = null,
        private val refreshError: Exception? = null,
    ) : AuthorizationRepository {
        var clearCalls = 0
        var refreshCalls = 0

        override fun hasRefreshSession(): Boolean = hasRefreshSession

        override suspend fun signIn(email: String, password: String): AccessGrant {
            signInError?.let { throw it }
            hasRefreshSession = true
            return AccessGrant("access-token", expiresAtMillis = 20_000L, refreshAtMillis = 5_000L)
        }

        override suspend fun refresh(): AccessGrant {
            refreshCalls += 1
            refreshGate?.await()
            refreshError?.let { throw it }
            return AccessGrant(
                "refreshed-token",
                expiresAtMillis = 100_000L,
                refreshAtMillis = 90_000L,
            )
        }

        override suspend fun getCurrentAccount(accessToken: String): AccountSummary = account

        override fun clearRefreshSession() {
            clearCalls += 1
            hasRefreshSession = false
        }
    }
}
