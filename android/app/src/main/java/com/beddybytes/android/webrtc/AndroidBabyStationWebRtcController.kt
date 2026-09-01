package com.beddybytes.android.webrtc

import android.content.Context
import android.graphics.Bitmap
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.Image
import java.nio.ByteBuffer
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.suspendCancellableCoroutine
import org.webrtc.AddIceObserver
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.JavaI420Buffer
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.VideoFrame
import org.webrtc.VideoSource
import org.webrtc.audio.JavaAudioDeviceModule

internal class AndroidBabyStationWebRtcController(
    context: Context,
    private val scope: CoroutineScope,
) : BabyStationWebRtcController {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(AudioManager::class.java)
    private val lock = Any()
    private var runtime: WebRtcRuntime? = null
    private var factoryResources: FactoryResources? = null

    override suspend fun start(
        request: WebRtcStartRequest,
        sendSignal: (WebRtcOutboundSignal) -> Unit,
        eventLogger: WebRtcEventLogger,
    ) {
        check(synchronized(lock) { runtime == null })
        val resources = factoryResources ?: createFactoryResources().also { factoryResources = it }
        val preferredMicrophone = preferredMicrophone(request.microphoneId)
        preferredMicrophone?.let(resources.audioDeviceModule::setPreferredInputDevice)
        val audioSource = resources.factory.createAudioSource(MediaConstraints())
        val audioTrack = resources.factory.createAudioTrack(AUDIO_TRACK_ID, audioSource)
        val videoSource = resources.factory.createVideoSource(false)
        val frameInput = CameraFrameInput(videoSource, eventLogger)
        val signalling =
            WebRtcSignallingSession(
                scope = scope,
                peerFactory =
                    WebRtcPeerFactory { peerClientId, onLocalCandidate ->
                        AndroidWebRtcPeer.create(
                            factory = resources.factory,
                            peerClientId = peerClientId,
                            audioTrack = audioTrack,
                            onLocalCandidate = onLocalCandidate,
                            eventLogger = eventLogger,
                        )
                    },
                sendSignal = sendSignal,
                eventLogger = eventLogger,
            )
        val startedRuntime =
            WebRtcRuntime(
                signalling = signalling,
                frameInput = frameInput,
                audioSource = audioSource,
                audioTrack = audioTrack,
                videoSource = videoSource,
                eventLogger = eventLogger,
            )
        synchronized(lock) {
            check(runtime == null)
            runtime = startedRuntime
        }
        eventLogger.log(
            "webrtc_started",
            mapOf(
                "local_client_id" to request.localClientId,
                "microphone_id" to (preferredMicrophone?.id?.toString() ?: "default"),
                "ice_servers" to "0",
                "media_mode" to "audio_only_confirmation",
                "audio_track_created" to "true",
                "video_track_created" to "false",
            ),
        )
    }

    override fun handle(signal: WebRtcInboundSignal) {
        synchronized(lock) { runtime }?.signalling?.handle(signal)
    }

    override fun onCameraFrame(image: Image, rotationDegrees: Int) {
        synchronized(lock) { runtime }?.frameInput?.onFrame(image, rotationDegrees)
    }

    override fun onProcessedCameraFrame(bitmap: Bitmap?, timestampNanoseconds: Long) {
        synchronized(lock) { runtime }
            ?.frameInput
            ?.onProcessedFrame(bitmap, timestampNanoseconds)
    }

    override suspend fun stop() {
        val stoppingRuntime = synchronized(lock) { runtime.also { runtime = null } } ?: return
        stoppingRuntime.frameInput.close()
        stoppingRuntime.signalling.close()
        stoppingRuntime.audioTrack.dispose()
        stoppingRuntime.audioSource.dispose()
        stoppingRuntime.videoSource.dispose()
        stoppingRuntime.eventLogger.log("webrtc_stopped", emptyMap())
    }

    private fun preferredMicrophone(id: Int?): AudioDeviceInfo? {
        if (id == null) return null
        return audioManager
            .getDevices(AudioManager.GET_DEVICES_INPUTS)
            .firstOrNull { device -> device.id == id }
    }

    private fun createFactoryResources(): FactoryResources {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions(),
        )
        val eglBase = EglBase.create()
        val audioDeviceModule =
            JavaAudioDeviceModule.builder(appContext)
                .setUseHardwareAcousticEchoCanceler(true)
                .setUseHardwareNoiseSuppressor(true)
                .createAudioDeviceModule()
        val factory =
            PeerConnectionFactory.builder()
                .setAudioDeviceModule(audioDeviceModule)
                .setVideoEncoderFactory(
                    DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true),
                ).setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
                .createPeerConnectionFactory()
        return FactoryResources(factory, audioDeviceModule, eglBase)
    }

    private data class FactoryResources(
        val factory: PeerConnectionFactory,
        val audioDeviceModule: JavaAudioDeviceModule,
        @Suppress("unused") val eglBase: EglBase,
    )

    private data class WebRtcRuntime(
        val signalling: WebRtcSignallingSession,
        val frameInput: CameraFrameInput,
        val audioSource: AudioSource,
        val audioTrack: AudioTrack,
        val videoSource: VideoSource,
        val eventLogger: WebRtcEventLogger,
    )

    private companion object {
        const val AUDIO_TRACK_ID = "beddybytes-audio"
    }
}

private class CameraFrameInput(
    videoSource: VideoSource,
    private val eventLogger: WebRtcEventLogger,
) {
    private val observer = videoSource.capturerObserver
    private val lock = Any()
    private var running = true
    private var processedOutputActive = false
    private var lastFrameTimestampNanoseconds = Long.MIN_VALUE

    init {
        observer.onCapturerStarted(true)
    }

    fun onFrame(image: Image, rotationDegrees: Int) {
        synchronized(lock) {
            if (!running || processedOutputActive) return
            if (lastFrameTimestampNanoseconds != Long.MIN_VALUE &&
                image.timestamp - lastFrameTimestampNanoseconds < MIN_FRAME_INTERVAL_NANOSECONDS
            ) {
                return
            }
            val buffer = image.toI420Buffer()
            val frame =
                VideoFrame(
                    buffer,
                    normalizedRotation(rotationDegrees),
                    image.timestamp,
                )
            try {
                observer.onFrameCaptured(frame)
                lastFrameTimestampNanoseconds = image.timestamp
            } finally {
                frame.release()
            }
        }
    }

    fun onProcessedFrame(bitmap: Bitmap?, timestampNanoseconds: Long) {
        synchronized(lock) {
            if (!running) return
            if (bitmap == null) {
                if (processedOutputActive) {
                    processedOutputActive = false
                    lastFrameTimestampNanoseconds = Long.MIN_VALUE
                    eventLogger.log(
                        "webrtc_video_source_changed",
                        mapOf("source" to "camera_yuv"),
                    )
                }
                return
            }
            if (!processedOutputActive) {
                processedOutputActive = true
                eventLogger.log(
                    "webrtc_video_source_changed",
                    mapOf("source" to "processed_low_light"),
                )
            }
            val buffer = bitmap.toI420Buffer()
            val frameTimestamp =
                if (lastFrameTimestampNanoseconds != Long.MIN_VALUE &&
                    timestampNanoseconds <= lastFrameTimestampNanoseconds
                ) {
                    lastFrameTimestampNanoseconds + 1
                } else {
                    timestampNanoseconds
                }
            val frame = VideoFrame(buffer, 0, frameTimestamp)
            try {
                observer.onFrameCaptured(frame)
                lastFrameTimestampNanoseconds = frameTimestamp
            } finally {
                frame.release()
            }
        }
    }

    fun close() {
        synchronized(lock) {
            if (!running) return
            running = false
            observer.onCapturerStopped()
        }
    }

    private companion object {
        const val MIN_FRAME_INTERVAL_NANOSECONDS = 100_000_000L
    }
}

internal interface WebRtcPeerConnectionOperations : AutoCloseable {
    suspend fun setRemote(description: WebRtcDescription)

    fun addLocalAudioTrack()

    suspend fun createAnswer(): WebRtcDescription

    suspend fun setLocal(description: WebRtcDescription)

    suspend fun addCandidate(candidate: WebRtcCandidate)
}

internal class AndroidWebRtcPeer(private val operations: WebRtcPeerConnectionOperations) :
    WebRtcPeer {
    override suspend fun acceptOffer(offer: WebRtcDescription): WebRtcDescription {
        require(offer.type == "offer")
        operations.setRemote(offer)
        operations.addLocalAudioTrack()
        val answer = operations.createAnswer()
        operations.setLocal(answer)
        return answer
    }

    override suspend fun addCandidate(candidate: WebRtcCandidate) {
        operations.addCandidate(candidate)
    }

    override fun close() {
        operations.close()
    }

    companion object {
        fun create(
            factory: PeerConnectionFactory,
            peerClientId: String,
            audioTrack: AudioTrack,
            onLocalCandidate: (WebRtcCandidate) -> Unit,
            eventLogger: WebRtcEventLogger,
        ): AndroidWebRtcPeer {
            val observer =
                AndroidPeerObserver(
                    peerClientId = peerClientId,
                    onLocalCandidate = onLocalCandidate,
                    eventLogger = eventLogger,
                )
            val configuration =
                PeerConnection.RTCConfiguration(emptyList()).apply {
                    sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
                    continualGatheringPolicy =
                        PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
                }
            val peerConnection =
                checkNotNull(factory.createPeerConnection(configuration, observer))
            eventLogger.log(
                "webrtc_peer_created",
                mapOf("peer_client_id" to peerClientId),
            )
            return AndroidWebRtcPeer(
                NativePeerConnectionOperations(
                    peerConnection = peerConnection,
                    audioTrack = audioTrack,
                    peerClientId = peerClientId,
                    eventLogger = eventLogger,
                ),
            )
        }
    }
}

private class NativePeerConnectionOperations(
    private val peerConnection: PeerConnection,
    private val audioTrack: AudioTrack,
    private val peerClientId: String,
    private val eventLogger: WebRtcEventLogger,
) : WebRtcPeerConnectionOperations {
    override suspend fun setRemote(description: WebRtcDescription) {
        log("webrtc_remote_description_summary", summarizeSdp(description))
        log("webrtc_remote_description_started")
        peerConnection.setRemote(
            SessionDescription(SessionDescription.Type.OFFER, description.sdp),
        )
        log("webrtc_remote_description_set")
    }

    override fun addLocalAudioTrack() {
        checkNotNull(peerConnection.addTrack(audioTrack, listOf(MEDIA_STREAM_ID)))
        log("webrtc_local_audio_track_added")
    }

    override suspend fun createAnswer(): WebRtcDescription {
        val answer = peerConnection.createAnswer()
        val description = WebRtcDescription(type = "answer", sdp = answer.description)
        log("webrtc_answer_description_summary", summarizeSdp(description))
        log("webrtc_answer_sdp_created")
        return description
    }

    override suspend fun setLocal(description: WebRtcDescription) {
        peerConnection.setLocal(
            SessionDescription(SessionDescription.Type.ANSWER, description.sdp),
        )
        log("webrtc_local_description_set")
    }

    override suspend fun addCandidate(candidate: WebRtcCandidate) {
        peerConnection.addCandidate(
            IceCandidate(
                candidate.sdpMid,
                candidate.sdpMLineIndex ?: 0,
                candidate.candidate,
            ),
        )
    }

    override fun close() {
        peerConnection.close()
        peerConnection.dispose()
    }

    private fun log(event: String, fields: Map<String, String> = emptyMap()) {
        eventLogger.log(event, fields + ("peer_client_id" to peerClientId))
    }

    private companion object {
        const val MEDIA_STREAM_ID = "beddybytes-stream"
    }
}

internal fun summarizeSdp(description: WebRtcDescription): Map<String, String> {
    val sections = mutableListOf<SdpMediaSection>()
    var sessionDirection: String? = null
    var bundleMids = emptyList<String>()
    description.sdp.lineSequence().forEach { rawLine ->
        val line = rawLine.trim()
        when {
            line.startsWith("m=") -> {
                sections +=
                    SdpMediaSection(
                        kind = safeSdpToken(line.substringAfter("m=").substringBefore(' ')),
                    )
            }

            line.startsWith("a=mid:") -> sections.lastOrNull()?.mid =
                safeSdpToken(line.substringAfter("a=mid:"))

            line in SDP_DIRECTION_LINES -> {
                val direction = line.substringAfter("a=")
                if (sections.isEmpty()) {
                    sessionDirection = direction
                } else {
                    sections.last().direction =
                        direction
                }
            }

            line.startsWith("a=rtpmap:") -> {
                val codec = line.substringAfter(
                    ' ',
                    "",
                ).substringBefore('/').takeIf(String::isNotBlank)
                if (codec != null) sections.lastOrNull()?.codecs?.add(safeSdpToken(codec))
            }

            line.startsWith("a=group:BUNDLE ") -> {
                bundleMids = line.substringAfter("a=group:BUNDLE ").split(' ').map(::safeSdpToken)
            }
        }
    }
    val mediaSections =
        sections.joinToString(";") { section ->
            val direction = section.direction ?: sessionDirection ?: "unspecified"
            val codecs = section.codecs.joinToString("|").ifEmpty { "none" }
            "${section.kind}[mid=${section.mid ?: "none"},direction=$direction,codecs=$codecs]"
        }
    return mapOf(
        "description_type" to description.type,
        "sdp_bytes" to description.sdp.toByteArray(Charsets.UTF_8).size.toString(),
        "media_section_count" to sections.size.toString(),
        "media_sections" to mediaSections,
        "bundle_mids" to bundleMids.joinToString("|").ifEmpty { "none" },
    )
}

private data class SdpMediaSection(
    val kind: String,
    var mid: String? = null,
    var direction: String? = null,
    val codecs: LinkedHashSet<String> = linkedSetOf(),
)

private fun safeSdpToken(value: String): String =
    value.take(MAX_SDP_TOKEN_LENGTH).replace(Regex("[^A-Za-z0-9._-]"), "_")

private val SDP_DIRECTION_LINES = setOf("a=sendrecv", "a=sendonly", "a=recvonly", "a=inactive")
private const val MAX_SDP_TOKEN_LENGTH = 64

private class AndroidPeerObserver(
    private val peerClientId: String,
    private val onLocalCandidate: (WebRtcCandidate) -> Unit,
    private val eventLogger: WebRtcEventLogger,
) : PeerConnection.Observer {
    override fun onConnectionChange(newState: PeerConnection.PeerConnectionState) {
        eventLogger.log(
            "webrtc_peer_connection_state",
            mapOf(
                "peer_client_id" to peerClientId,
                "state" to newState.name.lowercase(),
            ),
        )
    }

    override fun onIceCandidate(candidate: IceCandidate) {
        onLocalCandidate(
            WebRtcCandidate(
                candidate = candidate.sdp,
                sdpMid = candidate.sdpMid,
                sdpMLineIndex = candidate.sdpMLineIndex,
            ),
        )
    }

    override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState) {
        eventLogger.log(
            "webrtc_ice_gathering_state",
            mapOf(
                "peer_client_id" to peerClientId,
                "state" to newState.name.lowercase(),
            ),
        )
    }

    override fun onSignalingChange(newState: PeerConnection.SignalingState) = Unit

    override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState) = Unit

    override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit

    override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) = Unit

    override fun onAddStream(stream: MediaStream) = Unit

    override fun onRemoveStream(stream: MediaStream) = Unit

    override fun onDataChannel(dataChannel: DataChannel) = Unit

    override fun onRenegotiationNeeded() = Unit

    override fun onAddTrack(receiver: RtpReceiver, mediaStreams: Array<out MediaStream>) = Unit
}

private suspend fun PeerConnection.setRemote(description: SessionDescription) {
    suspendCancellableCoroutine<Unit> { continuation ->
        setRemoteDescription(
            SetDescriptionObserver(
                onSuccess = { if (continuation.isActive) continuation.resume(Unit) },
                onFailure = { message ->
                    if (continuation.isActive) {
                        continuation.resumeWithException(WebRtcOperationException(message))
                    }
                },
            ),
            description,
        )
    }
}

private suspend fun PeerConnection.createAnswer(): SessionDescription =
    suspendCancellableCoroutine { continuation ->
        createAnswer(
            CreateDescriptionObserver(
                onSuccess = { description ->
                    if (continuation.isActive) continuation.resume(description)
                },
                onFailure = { message ->
                    if (continuation.isActive) {
                        continuation.resumeWithException(WebRtcOperationException(message))
                    }
                },
            ),
            MediaConstraints(),
        )
    }

private suspend fun PeerConnection.setLocal(description: SessionDescription) {
    suspendCancellableCoroutine<Unit> { continuation ->
        setLocalDescription(
            SetDescriptionObserver(
                onSuccess = { if (continuation.isActive) continuation.resume(Unit) },
                onFailure = { message ->
                    if (continuation.isActive) {
                        continuation.resumeWithException(WebRtcOperationException(message))
                    }
                },
            ),
            description,
        )
    }
}

private suspend fun PeerConnection.addCandidate(candidate: IceCandidate) {
    suspendCancellableCoroutine<Unit> { continuation ->
        addIceCandidate(
            candidate,
            object : AddIceObserver {
                override fun onAddSuccess() {
                    if (continuation.isActive) continuation.resume(Unit)
                }

                override fun onAddFailure(error: String) {
                    if (continuation.isActive) {
                        continuation.resumeWithException(WebRtcOperationException(error))
                    }
                }
            },
        )
    }
}

private class SetDescriptionObserver(
    private val onSuccess: () -> Unit,
    private val onFailure: (String) -> Unit,
) : SdpObserver {
    override fun onSetSuccess() = onSuccess()

    override fun onSetFailure(error: String) = onFailure(error)

    override fun onCreateSuccess(description: SessionDescription) = Unit

    override fun onCreateFailure(error: String) = Unit
}

private class CreateDescriptionObserver(
    private val onSuccess: (SessionDescription) -> Unit,
    private val onFailure: (String) -> Unit,
) : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription) = onSuccess(description)

    override fun onCreateFailure(error: String) = onFailure(error)

    override fun onSetSuccess() = Unit

    override fun onSetFailure(error: String) = Unit
}

private class WebRtcOperationException(message: String) : Exception(message)

private fun Image.toI420Buffer(): JavaI420Buffer {
    require(format == android.graphics.ImageFormat.YUV_420_888)
    val output = JavaI420Buffer.allocate(width, height)
    return try {
        copyPlane(planes[0], width, height, output.dataY, output.strideY)
        val chromaWidth = (width + 1) / 2
        val chromaHeight = (height + 1) / 2
        copyPlane(planes[1], chromaWidth, chromaHeight, output.dataU, output.strideU)
        copyPlane(planes[2], chromaWidth, chromaHeight, output.dataV, output.strideV)
        output
    } catch (error: Exception) {
        output.release()
        throw error
    }
}

private fun Bitmap.toI420Buffer(): JavaI420Buffer {
    val output = JavaI420Buffer.allocate(width, height)
    return try {
        val pixels = IntArray(width * height)
        getPixels(pixels, 0, width, 0, 0, width, height)
        copyGrayscaleArgbToI420(
            pixels = pixels,
            width = width,
            height = height,
            destinationY = output.dataY,
            strideY = output.strideY,
            destinationU = output.dataU,
            strideU = output.strideU,
            destinationV = output.dataV,
            strideV = output.strideV,
        )
        output
    } catch (error: Exception) {
        output.release()
        throw error
    }
}

internal fun copyGrayscaleArgbToI420(
    pixels: IntArray,
    width: Int,
    height: Int,
    destinationY: ByteBuffer,
    strideY: Int,
    destinationU: ByteBuffer,
    strideU: Int,
    destinationV: ByteBuffer,
    strideV: Int,
) {
    require(width > 0 && height > 0)
    require(pixels.size == width * height)
    require(strideY >= width)
    val chromaWidth = (width + 1) / 2
    val chromaHeight = (height + 1) / 2
    require(strideU >= chromaWidth && strideV >= chromaWidth)
    require((height - 1) * strideY + width <= destinationY.capacity())
    require((chromaHeight - 1) * strideU + chromaWidth <= destinationU.capacity())
    require((chromaHeight - 1) * strideV + chromaWidth <= destinationV.capacity())
    for (row in 0 until height) {
        for (column in 0 until width) {
            destinationY.put(
                row * strideY + column,
                (pixels[row * width + column] and 0xff).toByte(),
            )
        }
    }
    for (row in 0 until chromaHeight) {
        for (column in 0 until chromaWidth) {
            destinationU.put(row * strideU + column, NEUTRAL_CHROMA)
            destinationV.put(row * strideV + column, NEUTRAL_CHROMA)
        }
    }
}

private fun copyPlane(
    source: Image.Plane,
    width: Int,
    height: Int,
    destination: ByteBuffer,
    destinationStride: Int,
) {
    copyStridedPlane(
        source = source.buffer,
        width = width,
        height = height,
        sourceRowStride = source.rowStride,
        sourcePixelStride = source.pixelStride,
        destination = destination,
        destinationStride = destinationStride,
    )
}

internal fun copyStridedPlane(
    source: ByteBuffer,
    width: Int,
    height: Int,
    sourceRowStride: Int,
    sourcePixelStride: Int,
    destination: ByteBuffer,
    destinationStride: Int,
) {
    require(width > 0 && height > 0)
    require(sourceRowStride > 0 && sourcePixelStride > 0)
    require(destinationStride >= width)
    val sourceOffset = source.position()
    val finalSourceIndex =
        sourceOffset + (height - 1) * sourceRowStride + (width - 1) * sourcePixelStride
    require(finalSourceIndex < source.limit())
    require((height - 1) * destinationStride + width <= destination.capacity())
    for (row in 0 until height) {
        val sourceRow = sourceOffset + row * sourceRowStride
        val destinationRow = row * destinationStride
        if (sourcePixelStride == 1) {
            val rowBuffer = source.duplicate()
            rowBuffer.position(sourceRow)
            rowBuffer.limit(sourceRow + width)
            val destinationBuffer = destination.duplicate()
            destinationBuffer.position(destinationRow)
            destinationBuffer.put(rowBuffer)
        } else {
            for (column in 0 until width) {
                destination.put(
                    destinationRow + column,
                    source.get(sourceRow + column * sourcePixelStride),
                )
            }
        }
    }
}

private fun normalizedRotation(rotationDegrees: Int): Int {
    val normalized = ((rotationDegrees % 360) + 360) % 360
    require(normalized % 90 == 0)
    return normalized
}

private val NEUTRAL_CHROMA = 128.toByte()
