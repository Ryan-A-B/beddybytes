package com.beddybytes.android.webrtc

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

internal interface WebRtcPeer : AutoCloseable {
    suspend fun acceptOffer(offer: WebRtcDescription): WebRtcDescription

    suspend fun addCandidate(candidate: WebRtcCandidate)
}

internal fun interface WebRtcPeerFactory {
    fun create(peerClientId: String, onLocalCandidate: (WebRtcCandidate) -> Unit): WebRtcPeer
}

internal class WebRtcSignallingSession(
    private val scope: CoroutineScope,
    private val peerFactory: WebRtcPeerFactory,
    private val sendSignal: (WebRtcOutboundSignal) -> Unit,
    private val eventLogger: WebRtcEventLogger,
) {
    private val signals = Channel<WebRtcInboundSignal>(Channel.UNLIMITED)
    private val peers = mutableMapOf<String, WebRtcPeer>()
    private val candidatesBeforeOffer = mutableMapOf<String, MutableList<WebRtcCandidate>>()
    private var job: Job? =
        scope.launch {
            for (signal in signals) {
                when (signal) {
                    is WebRtcInboundSignal.Offer -> acceptOffer(signal)
                    is WebRtcInboundSignal.Candidate -> acceptCandidate(signal)
                }
            }
        }

    fun handle(signal: WebRtcInboundSignal) {
        if (!signals.trySend(signal).isSuccess) {
            eventLogger.log(
                "webrtc_signal_dropped",
                mapOf(
                    "peer_client_id" to signal.fromClientId,
                    "signal_type" to signal.logType,
                ),
            )
        }
    }

    suspend fun close() {
        signals.close()
        job?.cancelAndJoin()
        job = null
        peers.values.forEach(WebRtcPeer::close)
        peers.clear()
        candidatesBeforeOffer.clear()
    }

    private suspend fun acceptOffer(signal: WebRtcInboundSignal.Offer) {
        val peerClientId = signal.fromClientId
        peers.remove(peerClientId)?.let { existing ->
            existing.close()
            eventLogger.log(
                "webrtc_peer_replaced",
                mapOf("peer_client_id" to peerClientId),
            )
        }
        val peer =
            runCatching {
                peerFactory.create(peerClientId) { candidate ->
                    sendSignal(WebRtcOutboundSignal.Candidate(peerClientId, candidate))
                    eventLogger.log(
                        "webrtc_local_candidate",
                        mapOf("peer_client_id" to peerClientId),
                    )
                }
            }.getOrElse { error ->
                logFailure("webrtc_peer_create_failed", peerClientId, error)
                return
            }
        peers[peerClientId] = peer
        eventLogger.log("webrtc_offer_received", mapOf("peer_client_id" to peerClientId))
        val answer = try {
            peer.acceptOffer(signal.description)
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            if (peers.remove(peerClientId) === peer) peer.close()
            logFailure("webrtc_offer_failed", peerClientId, error)
            return
        }
        if (peers[peerClientId] !== peer) return
        sendSignal(WebRtcOutboundSignal.Answer(peerClientId, answer))
        eventLogger.log("webrtc_answer_created", mapOf("peer_client_id" to peerClientId))
        candidatesBeforeOffer.remove(peerClientId).orEmpty().forEach { candidate ->
            addCandidate(peerClientId, peer, candidate)
        }
    }

    private suspend fun acceptCandidate(signal: WebRtcInboundSignal.Candidate) {
        val peer = peers[signal.fromClientId]
        if (peer == null) {
            candidatesBeforeOffer
                .getOrPut(signal.fromClientId, ::mutableListOf)
                .add(signal.candidate)
            eventLogger.log(
                "webrtc_remote_candidate_buffered",
                mapOf("peer_client_id" to signal.fromClientId),
            )
            return
        }
        addCandidate(signal.fromClientId, peer, signal.candidate)
    }

    private suspend fun addCandidate(
        peerClientId: String,
        peer: WebRtcPeer,
        candidate: WebRtcCandidate,
    ) {
        try {
            peer.addCandidate(candidate)
            eventLogger.log(
                "webrtc_remote_candidate_added",
                mapOf("peer_client_id" to peerClientId),
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            logFailure("webrtc_remote_candidate_failed", peerClientId, error)
        }
    }

    private fun logFailure(event: String, peerClientId: String, error: Throwable) {
        eventLogger.log(
            event,
            mapOf(
                "peer_client_id" to peerClientId,
                "error_class" to error.javaClass.name,
            ),
        )
    }
}

private val WebRtcInboundSignal.logType: String
    get() = when (this) {
        is WebRtcInboundSignal.Offer -> "offer"
        is WebRtcInboundSignal.Candidate -> "candidate"
    }
