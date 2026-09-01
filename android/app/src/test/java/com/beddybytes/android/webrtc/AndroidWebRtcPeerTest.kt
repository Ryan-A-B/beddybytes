package com.beddybytes.android.webrtc

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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

    @Test
    fun `summarizes SDP structure without recording network or credential lines`() {
        val summary =
            summarizeSdp(
                WebRtcDescription(
                    type = "offer",
                    sdp =
                        """
                        v=0
                        a=group:BUNDLE 0 1
                        m=video 9 UDP/TLS/RTP/SAVPF 96 97
                        a=mid:0
                        a=recvonly
                        a=rtpmap:96 VP8/90000
                        a=rtpmap:97 H264/90000
                        a=ice-pwd:secret-value
                        a=candidate:private-address
                        m=audio 9 UDP/TLS/RTP/SAVPF 111
                        a=mid:1
                        a=recvonly
                        a=rtpmap:111 opus/48000/2
                        """.trimIndent(),
                ),
            )

        assertEquals("offer", summary.getValue("description_type"))
        assertEquals("2", summary.getValue("media_section_count"))
        assertEquals("0|1", summary.getValue("bundle_mids"))
        assertEquals(
            "video[mid=0,direction=recvonly,codecs=VP8|H264];" +
                "audio[mid=1,direction=recvonly,codecs=opus]",
            summary.getValue("media_sections"),
        )
        assertFalse(
            summary.values.any { value ->
                "secret-value" in value ||
                    "private-address" in value
            },
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
