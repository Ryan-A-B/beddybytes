package com.beddybytes.android.infrastructure

import com.beddybytes.android.BuildConfig

data class AppEnvironment(val apiBaseUrl: String, val mqttHost: String) {
    companion object {
        fun fromBuildConfig(): AppEnvironment = AppEnvironment(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            mqttHost = BuildConfig.MQTT_HOST,
        )
    }
}
