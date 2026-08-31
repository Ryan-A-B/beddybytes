package com.beddybytes.android.mqtt

import android.content.Context
import androidx.core.content.edit
import java.util.UUID

internal fun interface MqttClientIdStore {
    fun getOrCreate(): String
}

internal class AndroidMqttClientIdStore(context: Context) : MqttClientIdStore {
    private val preferences =
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun getOrCreate(): String = synchronized(preferences) {
        preferences.getString(CLIENT_ID_KEY, null)?.let { return@synchronized it }
        UUID.randomUUID().toString().also { clientId ->
            preferences.edit(commit = true) { putString(CLIENT_ID_KEY, clientId) }
        }
    }

    private companion object {
        const val PREFERENCES_NAME = "beddybytes_mqtt"
        const val CLIENT_ID_KEY = "client_id"
    }
}
