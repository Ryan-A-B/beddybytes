package com.beddybytes.android.authorization

import kotlin.math.min
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class AuthorizationSession internal constructor(
    private val repository: AuthorizationRepository,
    private val scope: CoroutineScope,
    private val clock: AuthorizationClock,
) {
    private val operationMutex = Mutex()
    private val mutableState =
        MutableStateFlow<AuthorizationState>(
            if (repository.hasRefreshSession()) {
                AuthorizationState.RestoringSession
            } else {
                AuthorizationState.SignedOut()
            },
        )
    private var activeSession: ActiveSession? = null
    private var restoreJob: Job? = null
    private var tokenMaintenanceJob: Job? = null

    val state: StateFlow<AuthorizationState> = mutableState.asStateFlow()

    fun start() {
        if (repository.hasRefreshSession()) beginRestoration()
    }

    suspend fun signIn(email: String, password: String) {
        stopBackgroundWork()
        var shouldRestore = false
        var shouldMaintainToken = false
        operationMutex.withLock {
            mutableState.value = AuthorizationState.SigningIn(email)
            try {
                val grant = repository.signIn(email, password)
                val account = repository.getCurrentAccount(grant.accessToken)
                activeSession = ActiveSession(account, grant)
                mutableState.value = AuthorizationState.Authorized(account)
                shouldMaintainToken = true
            } catch (_: AuthorizationRejectedException) {
                activeSession = null
                repository.clearRefreshSession()
                mutableState.value =
                    AuthorizationState.SignedOut(SignInFailure.INVALID_CREDENTIALS)
            } catch (_: AuthorizationUnavailableException) {
                activeSession = null
                shouldRestore = repository.hasRefreshSession()
                mutableState.value =
                    if (shouldRestore) {
                        AuthorizationState.Unavailable(account = null)
                    } else {
                        AuthorizationState.SignedOut(SignInFailure.CONNECTION)
                    }
            }
        }
        if (shouldRestore) beginRestoration()
        if (shouldMaintainToken) beginTokenMaintenance()
    }

    suspend fun signOut() {
        stopBackgroundWork()
        operationMutex.withLock {
            activeSession = null
            repository.clearRefreshSession()
            mutableState.value = AuthorizationState.SignedOut()
        }
    }

    suspend fun getAccessToken(): String = operationMutex.withLock {
        val session = activeSession ?: throw AuthenticationRequiredException()
        if (clock.nowMillis() < session.grant.refreshAtMillis) {
            mutableState.value = AuthorizationState.Authorized(session.account)
            return@withLock session.grant.accessToken
        }

        mutableState.value = AuthorizationState.Refreshing(session.account)
        try {
            val refreshedGrant = repository.refresh()
            activeSession = session.copy(grant = refreshedGrant)
            mutableState.value = AuthorizationState.Authorized(session.account)
            beginTokenMaintenance()
            refreshedGrant.accessToken
        } catch (_: AuthorizationRejectedException) {
            activeSession = null
            repository.clearRefreshSession()
            mutableState.value = AuthorizationState.SignedOut()
            throw AuthenticationRequiredException()
        } catch (error: AuthorizationUnavailableException) {
            mutableState.value = AuthorizationState.Unavailable(session.account)
            beginTokenMaintenance()
            throw error
        }
    }

    fun onAppForeground() {
        val currentState = state.value
        val hasAccount =
            currentState is AuthorizationState.Authorized ||
                currentState is AuthorizationState.Refreshing ||
                (currentState is AuthorizationState.Unavailable && currentState.account != null)
        if (!hasAccount) return
        scope.launch {
            runCatching { getAccessToken() }
        }
    }

    private fun beginRestoration() {
        if (restoreJob?.isActive == true) return
        restoreJob =
            scope.launch {
                var retryDelay = INITIAL_RETRY_DELAY_MILLIS
                while (currentCoroutineContext().isActive && repository.hasRefreshSession()) {
                    val restored = restoreOnce()
                    if (restored || !repository.hasRefreshSession()) return@launch
                    delay(retryDelay)
                    retryDelay = min(retryDelay * 2, MAX_RETRY_DELAY_MILLIS)
                }
            }
    }

    private suspend fun restoreOnce(): Boolean = operationMutex.withLock {
        if (activeSession != null) return@withLock true
        mutableState.value = AuthorizationState.RestoringSession
        try {
            val grant = repository.refresh()
            val account = repository.getCurrentAccount(grant.accessToken)
            activeSession = ActiveSession(account, grant)
            mutableState.value = AuthorizationState.Authorized(account)
            beginTokenMaintenance()
            true
        } catch (_: AuthorizationRejectedException) {
            repository.clearRefreshSession()
            mutableState.value = AuthorizationState.SignedOut()
            true
        } catch (_: AuthorizationUnavailableException) {
            mutableState.value = AuthorizationState.Unavailable(account = null)
            false
        }
    }

    private fun beginTokenMaintenance() {
        if (tokenMaintenanceJob?.isActive == true) return
        tokenMaintenanceJob =
            scope.launch {
                var retryDelay = INITIAL_RETRY_DELAY_MILLIS
                while (currentCoroutineContext().isActive) {
                    val waitUntilRefresh =
                        operationMutex.withLock {
                            activeSession?.grant?.refreshAtMillis?.minus(clock.nowMillis())
                        } ?: return@launch
                    if (waitUntilRefresh > 0) delay(waitUntilRefresh)
                    try {
                        getAccessToken()
                        retryDelay = INITIAL_RETRY_DELAY_MILLIS
                    } catch (_: AuthenticationRequiredException) {
                        return@launch
                    } catch (_: AuthorizationUnavailableException) {
                        delay(retryDelay)
                        retryDelay = min(retryDelay * 2, MAX_RETRY_DELAY_MILLIS)
                    }
                }
            }
    }

    private suspend fun stopBackgroundWork() {
        restoreJob?.cancelAndJoin()
        restoreJob = null
        tokenMaintenanceJob?.cancelAndJoin()
        tokenMaintenanceJob = null
    }

    private data class ActiveSession(val account: AccountSummary, val grant: AccessGrant)

    private companion object {
        const val INITIAL_RETRY_DELAY_MILLIS = 1_000L
        const val MAX_RETRY_DELAY_MILLIS = 2 * 60 * 1_000L
    }
}
