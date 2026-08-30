package com.beddybytes.android.babystation

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class BabyStationPreferences(context: Context, scope: CoroutineScope) : BabyStationSettingsStore {
    private val dataStore: DataStore<Preferences> =
        PreferenceDataStoreFactory.create(scope = scope) {
            context.preferencesDataStoreFile("baby_station.preferences_pb")
        }

    override val settings: Flow<BabyStationSettings> =
        dataStore.data.map { preferences ->
            BabyStationSettings(
                name = preferences[StationName] ?: "Nursery",
                cameraId = preferences[CameraId],
                microphoneId = preferences[MicrophoneId],
            )
        }

    override suspend fun setName(name: String) {
        dataStore.edit { it[StationName] = name }
    }

    override suspend fun setCameraId(cameraId: String) {
        dataStore.edit { it[CameraId] = cameraId }
    }

    override suspend fun setMicrophoneId(microphoneId: Int) {
        dataStore.edit { it[MicrophoneId] = microphoneId }
    }

    private companion object {
        val StationName = stringPreferencesKey("station_name")
        val CameraId = stringPreferencesKey("camera_id")
        val MicrophoneId = intPreferencesKey("microphone_id")
    }
}
