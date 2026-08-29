package com.beddybytes.android.infrastructure

import com.beddybytes.android.BuildConfig

data class AppEnvironment(
    val apiBaseUrl: String,
    val mqttHost: String,
    val accountWebUrl: String,
) {
    companion object {
        fun fromBuildConfig(): AppEnvironment = AppEnvironment(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            mqttHost = BuildConfig.MQTT_HOST,
            accountWebUrl = BuildConfig.ACCOUNT_WEB_URL,
        )
    }
}
