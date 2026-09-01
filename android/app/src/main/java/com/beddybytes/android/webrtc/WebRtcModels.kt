package com.beddybytes.android.webrtc

import android.graphics.Bitmap
import android.media.Image

internal data class WebRtcDescription(val type: String, val sdp: String)

internal data class WebRtcCandidate(
    val candidate: String,
    val sdpMid: String?,
    val sdpMLineIndex: Int?,
)

internal sealed interface WebRtcInboundSignal {
    val fromClientId: String

    data class Offer(override val fromClientId: String, val description: WebRtcDescription) :
        WebRtcInboundSignal

    data class Candidate(override val fromClientId: String, val candidate: WebRtcCandidate) :
        WebRtcInboundSignal
}

internal sealed interface WebRtcOutboundSignal {
    val peerClientId: String

    data class Answer(override val peerClientId: String, val description: WebRtcDescription) :
        WebRtcOutboundSignal

    data class Candidate(override val peerClientId: String, val candidate: WebRtcCandidate) :
        WebRtcOutboundSignal
}

internal data class WebRtcStartRequest(val localClientId: String, val microphoneId: Int?)

internal fun interface WebRtcEventLogger {
    fun log(event: String, fields: Map<String, String>)
}

internal interface BabyStationWebRtcController {
    suspend fun start(
        request: WebRtcStartRequest,
        sendSignal: (WebRtcOutboundSignal) -> Unit,
        eventLogger: WebRtcEventLogger,
    )

    fun handle(signal: WebRtcInboundSignal)

    fun onCameraFrame(image: Image, rotationDegrees: Int)

    fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long)

    suspend fun stop()
}

internal object NoOpBabyStationWebRtcController : BabyStationWebRtcController {
    override suspend fun start(
        request: WebRtcStartRequest,
        sendSignal: (WebRtcOutboundSignal) -> Unit,
        eventLogger: WebRtcEventLogger,
    ) = Unit

    override fun handle(signal: WebRtcInboundSignal) = Unit

    override fun onCameraFrame(image: Image, rotationDegrees: Int) = Unit

    override fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long) = Unit

    override suspend fun stop() = Unit
}
