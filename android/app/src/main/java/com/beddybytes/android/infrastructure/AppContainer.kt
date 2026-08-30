package com.beddybytes.android.infrastructure

import android.content.Context
import com.beddybytes.android.authorization.AuthorizationClock
import com.beddybytes.android.authorization.AuthorizationSession
import com.beddybytes.android.authorization.DefaultAuthorizationRepository
import com.beddybytes.android.authorization.EncryptedRefreshCookiePersistence
import com.beddybytes.android.authorization.RefreshCookieStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import okhttp3.OkHttpClient

class AppContainer(context: Context) {
    private val environment = AppEnvironment.fromBuildConfig()
    private val clock = AuthorizationClock(System::currentTimeMillis)
    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val refreshCookieStore =
        RefreshCookieStore(
            persistence = EncryptedRefreshCookiePersistence(context),
            clock = clock,
        )
    private val httpClient =
        OkHttpClient.Builder()
            .cookieJar(refreshCookieStore)
            .build()
    private val authorizationRepository =
        DefaultAuthorizationRepository(
            apiBaseUrl = environment.apiBaseUrl,
            client = httpClient,
            refreshCookieStore = refreshCookieStore,
            clock = clock,
        )

    val authorizationSession =
        AuthorizationSession(
            repository = authorizationRepository,
            scope = applicationScope,
            clock = clock,
        )
}
