package com.beddybytes.android.babystation

import android.content.Context
import android.graphics.Bitmap
import android.media.Image
import androidx.core.content.ContextCompat
import com.beddybytes.android.BabyStationService
import com.beddybytes.android.mqtt.BabyStationSessionController
import com.beddybytes.android.mqtt.BabyStationSessionState
import com.beddybytes.android.mqtt.BabyStationStartRequest
import kotlinx.coroutines.flow.StateFlow

internal class BabyStationForegroundController(
    context: Context,
    private val activeSession: ActiveBabyStationSession,
) : BabyStationSessionController {
    private val appContext = context.applicationContext

    override val state: StateFlow<BabyStationSessionState> = activeSession.state
    val cameraState: StateFlow<ActiveCameraState> = activeSession.cameraState

    override fun start(request: BabyStationStartRequest) {
        ContextCompat.startForegroundService(
            appContext,
            BabyStationService.startIntent(appContext, request),
        )
    }

    override fun stop() {
        if (state.value == BabyStationSessionState.Ready) return
        appContext.startService(BabyStationService.stopIntent(appContext, "app"))
    }

    override fun onCameraFrame(image: Image, rotationDegrees: Int) = Unit

    override fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long) = Unit

    override fun recordEvent(event: String, fields: Map<String, String>) {
        activeSession.recordEvent(event, fields)
    }
}
