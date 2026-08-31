package com.beddybytes.android.ui

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class DebugRawFrameRecorderTest {
    @Test
    fun `recording directory is camera and UTC timestamp specific`() {
        assertEquals(
            "camera-rear_0-2026-08-31T05-06-07Z",
            recordingDirectoryName("rear/0", Instant.parse("2026-08-31T05:06:07Z")),
        )
    }

    @Test
    fun `raw frame filenames preserve ordering and sensor timestamp`() {
        assertEquals(
            "frame-000012-987654321.dng",
            rawFrameFilename(frameNumber = 12, sensorTimestampNanoseconds = 987654321L),
        )
    }
}
