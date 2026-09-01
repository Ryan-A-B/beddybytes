package com.beddybytes.android.webrtc

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidWebRtcPeerTest {
    @Test
    fun `accepts browser offer before adding only the local audio track`() = runTest {
        val operations = RecordingPeerConnectionOperations()
        val peer = AndroidWebRtcPeer(operations)

        val answer = peer.acceptOffer(WebRtcDescription("offer", "browser-offer"))

        assertEquals(WebRtcDescription("answer", "android-answer"), answer)
        assertEquals(
            listOf(
                "set_remote:browser-offer",
                "add_local_audio_track",
                "create_answer",
                "set_local:android-answer",
            ),
            operations.calls,
        )
    }

    private class RecordingPeerConnectionOperations : WebRtcPeerConnectionOperations {
        val calls = mutableListOf<String>()

        override suspend fun setRemote(description: WebRtcDescription) {
            calls += "set_remote:${description.sdp}"
        }

        override fun addLocalAudioTrack() {
            calls += "add_local_audio_track"
        }

        override suspend fun createAnswer(): WebRtcDescription {
            calls += "create_answer"
            return WebRtcDescription("answer", "android-answer")
        }

        override suspend fun setLocal(description: WebRtcDescription) {
            calls += "set_local:${description.sdp}"
        }

        override suspend fun addCandidate(candidate: WebRtcCandidate) = Unit

        override fun close() = Unit
    }
}
