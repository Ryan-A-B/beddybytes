package com.beddybytes.android.infrastructure

import android.content.Context
import com.beddybytes.android.BuildConfig
import com.beddybytes.android.authorization.AuthorizationClock
import com.beddybytes.android.authorization.AuthorizationSession
import com.beddybytes.android.authorization.DefaultAuthorizationRepository
import com.beddybytes.android.authorization.EncryptedRefreshCookiePersistence
import com.beddybytes.android.authorization.RefreshCookieStore
import com.beddybytes.android.babystation.ActiveBabyStationSession
import com.beddybytes.android.babystation.AndroidDeviceCatalog
import com.beddybytes.android.babystation.BabyStationForegroundController
import com.beddybytes.android.babystation.BabyStationPreferences
import com.beddybytes.android.mqtt.AndroidMqttClientIdStore
import com.beddybytes.android.mqtt.AndroidSessionEventLogFactory
import com.beddybytes.android.mqtt.AuthorizationMqttCredentialsProvider
import com.beddybytes.android.mqtt.BabyStationMqttSession
import com.beddybytes.android.mqtt.HiveMqttTransport
import com.beddybytes.android.mqtt.NoOpSessionEventLogFactory
import com.beddybytes.android.webrtc.AndroidBabyStationWebRtcController
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

    private val babyStationMqttSession =
        BabyStationMqttSession(
            mqttHost = environment.mqttHost,
            credentialsProvider = AuthorizationMqttCredentialsProvider(authorizationSession),
            clientIdStore = AndroidMqttClientIdStore(context),
            transport = HiveMqttTransport(),
            scope = applicationScope,
            webRtcController =
                AndroidBabyStationWebRtcController(
                    context = context,
                    scope = applicationScope,
                ),
            eventLogFactory =
                if (BuildConfig.DEBUG) {
                    AndroidSessionEventLogFactory(context)
                } else {
                    NoOpSessionEventLogFactory
                },
        )

    internal val activeBabyStationSession =
        ActiveBabyStationSession(
            context = context,
            session = babyStationMqttSession,
            scope = applicationScope,
        )

    internal val babyStationSession =
        BabyStationForegroundController(
            context = context,
            activeSession = activeBabyStationSession,
        )

    val babyStationPreferences = BabyStationPreferences(context, applicationScope)
    val androidDeviceCatalog = AndroidDeviceCatalog(context)
}
