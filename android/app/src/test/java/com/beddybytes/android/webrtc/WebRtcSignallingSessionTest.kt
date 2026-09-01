package com.beddybytes.android.webrtc

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WebRtcSignallingSessionTest {
    @Test
    fun `buffers remote candidates until an offer has been answered`() = runTest {
        val harness = Harness(this)
        val candidate = WebRtcCandidate("candidate:remote", "0", 0)

        harness.session.handle(WebRtcInboundSignal.Candidate("parent", candidate))
        harness.session.handle(offer("parent"))
        runCurrent()

        assertEquals(listOf(candidate), harness.peers.single().candidates)
        assertEquals(
            WebRtcOutboundSignal.Answer(
                "parent",
                WebRtcDescription("answer", "answer-for-parent"),
            ),
            harness.outbound.single(),
        )
        harness.session.close()
    }

    @Test
    fun `local candidates are routed to their parent`() = runTest {
        val harness = Harness(this)
        harness.session.handle(offer("parent"))
        runCurrent()
        val candidate = WebRtcCandidate("candidate:local", "audio", 1)

        harness.peers.single().emitLocalCandidate(candidate)

        assertTrue(
            harness.outbound.contains(WebRtcOutboundSignal.Candidate("parent", candidate)),
        )
        harness.session.close()
    }

    @Test
    fun `a replacement offer closes only that parents previous peer`() = runTest {
        val harness = Harness(this)
        harness.session.handle(offer("parent-a"))
        harness.session.handle(offer("parent-b"))
        harness.session.handle(offer("parent-a"))
        runCurrent()

        assertEquals(3, harness.peers.size)
        assertTrue(harness.peers[0].closed)
        assertTrue(!harness.peers[1].closed)
        assertTrue(!harness.peers[2].closed)

        harness.session.close()
        assertTrue(harness.peers.drop(1).all(FakePeer::closed))
    }

    private fun offer(peerClientId: String) = WebRtcInboundSignal.Offer(
        peerClientId,
        WebRtcDescription("offer", "offer-from-$peerClientId"),
    )

    private class Harness(scope: kotlinx.coroutines.CoroutineScope) {
        val peers = mutableListOf<FakePeer>()
        val outbound = mutableListOf<WebRtcOutboundSignal>()
        val session =
            WebRtcSignallingSession(
                scope = scope,
                peerFactory = WebRtcPeerFactory { clientId, onCandidate ->
                    FakePeer(clientId, onCandidate).also(peers::add)
                },
                sendSignal = outbound::add,
                eventLogger = WebRtcEventLogger { _, _ -> },
            )
    }

    private class FakePeer(
        private val clientId: String,
        private val onCandidate: (WebRtcCandidate) -> Unit,
    ) : WebRtcPeer {
        val candidates = mutableListOf<WebRtcCandidate>()
        var closed = false

        override suspend fun acceptOffer(offer: WebRtcDescription): WebRtcDescription {
            assertEquals("offer-from-$clientId", offer.sdp)
            return WebRtcDescription("answer", "answer-for-$clientId")
        }

        override suspend fun addCandidate(candidate: WebRtcCandidate) {
            candidates += candidate
        }

        fun emitLocalCandidate(candidate: WebRtcCandidate) = onCandidate(candidate)

        override fun close() {
            closed = true
        }
    }
}
