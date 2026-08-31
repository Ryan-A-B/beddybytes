package com.beddybytes.android.ui

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.beddybytes.android.BuildConfig
import java.io.BufferedWriter
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.time.Instant
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

internal class CameraTelemetryLogger(
    context: Context,
    private val cameraId: String,
    private val recordingSession: DebugCameraRecordingSession,
) {
    private val appContext = context.applicationContext
    private val readings = Channel<CameraTelemetry>(Channel.UNLIMITED)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var lastReadingElapsedMilliseconds = Long.MIN_VALUE

    init {
        scope.launch {
            var writer: BufferedWriter? = null
            try {
                for (telemetry in readings) {
                    if (writer == null) writer = openWriter(telemetry)
                    writer.append(readingLine(telemetry))
                    writer.newLine()
                    writer.flush()
                }
            } catch (error: Throwable) {
                Log.e(LOG_TAG, "Unable to write camera telemetry", error)
            } finally {
                writer?.close()
            }
        }
    }

    @Synchronized
    fun record(telemetry: CameraTelemetry) {
        val now = SystemClock.elapsedRealtime()
        if (lastReadingElapsedMilliseconds != Long.MIN_VALUE &&
            now - lastReadingElapsedMilliseconds < READING_INTERVAL_MILLISECONDS
        ) {
            return
        }
        lastReadingElapsedMilliseconds = now
        readings.trySend(telemetry)
    }

    fun close() {
        readings.close()
    }

    private fun openWriter(firstReading: CameraTelemetry): BufferedWriter {
        val apkSha256 = apkSha256()
        recordingSession.ensureStarted()
        val file = File(recordingSession.directory, LOG_FILENAME)
        val needsHeader = !file.exists() || file.length() == 0L
        return FileOutputStream(file, true).bufferedWriter().also { writer ->
            if (needsHeader) {
                runCatching { writeHeader(writer, firstReading, apkSha256) }
                    .onFailure { error ->
                        writer.header(
                            "header_error",
                            "${error.javaClass.simpleName}: ${error.message.orEmpty()}",
                        )
                        Log.w(LOG_TAG, "Some camera telemetry metadata was unavailable", error)
                    }
                writeColumnHeader(writer)
                writer.flush()
            }
        }
    }

    private fun writeHeader(
        writer: BufferedWriter,
        telemetry: CameraTelemetry,
        apkSha256: String,
    ) {
        val cameraManager = appContext.getSystemService(CameraManager::class.java)
        val characteristics = cameraManager.getCameraCharacteristics(cameraId)
        writer.header("schema", "beddybytes-camera-telemetry-v4")
        writer.flush()
        writer.header("created_utc", DateTimeFormatter.ISO_INSTANT.format(Instant.now()))
        writer.header("app_version_name", BuildConfig.VERSION_NAME)
        writer.header("app_version_code", BuildConfig.VERSION_CODE)
        writer.header("app_build_type", BuildConfig.BUILD_TYPE)
        writer.header("app_flavor", BuildConfig.FLAVOR)
        writer.header("apk_sha256", apkSha256)
        writer.header("device_manufacturer", Build.MANUFACTURER)
        writer.header("device_model", Build.MODEL)
        writer.header("android_release", Build.VERSION.RELEASE)
        writer.header("android_sdk", Build.VERSION.SDK_INT)
        writer.header("android_build_fingerprint", Build.FINGERPRINT)
        writeCameraHeader(
            writer = writer,
            prefix = "camera",
            id = cameraId,
            characteristics = characteristics,
            includePhysicalRequestKeys = true,
        )
        writer.header(
            "camera.preview_resolution",
            if (telemetry.width != null && telemetry.height != null) {
                "${telemetry.width}x${telemetry.height}"
            } else {
                "unknown"
            },
        )
        writer.header("camera.low_light_boost_supported", telemetry.lowLightBoostSupported)
        writer.header(
            "camera.target_physical_camera_id",
            telemetry.targetPhysicalCameraId ?: "none",
        )
        writer.header(
            "camera.requested_fps_range",
            telemetry.requestedFrameRateRange?.rangeValue() ?: "unknown",
        )

        characteristics.physicalCameraIds.sorted().forEach { physicalId ->
            runCatching { cameraManager.getCameraCharacteristics(physicalId) }
                .onSuccess { physicalCharacteristics ->
                    writeCameraHeader(
                        writer = writer,
                        prefix = "physical_camera.$physicalId",
                        id = physicalId,
                        characteristics = physicalCharacteristics,
                        includePhysicalRequestKeys = false,
                    )
                }
        }
    }

    private fun writeColumnHeader(writer: BufferedWriter) {
        writer.appendLine(
            listOf(
                "utc",
                "sensor_timestamp_ns",
                "width",
                "height",
                "exposure_ns",
                "frame_duration_ns",
                "iso",
                "measured_fps",
                "ae_state",
                "applied_fps_range",
                "low_light_boost_active",
                "exposure_control_mode",
                "requested_exposure_ns",
                "requested_iso",
                "monochrome",
                "rolling_stack_frame_count",
                "rolling_stack_brightness_gain",
                "active_physical_camera_id",
                "focal_length_mm",
                "zoom_ratio",
            ).joinToString(","),
        )
    }

    private fun writeCameraHeader(
        writer: BufferedWriter,
        prefix: String,
        id: String,
        characteristics: CameraCharacteristics,
        includePhysicalRequestKeys: Boolean,
    ) {
        writer.header("$prefix.id", id)
        writer.header(
            "$prefix.lens_facing",
            characteristics.get(CameraCharacteristics.LENS_FACING)?.lensFacingValue() ?: "unknown",
        )
        writer.header(
            "$prefix.hardware_level",
            characteristics.get(CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL)
                ?.hardwareLevelValue()
                ?: "unknown",
        )
        writer.header(
            "$prefix.physical_ids",
            characteristics.physicalCameraIds.sorted().joinToString(";"),
        )
        writer.header(
            "$prefix.sensor_physical_size_mm",
            characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)?.let {
                "${it.width}x${it.height}"
            } ?: "unknown",
        )
        writer.header(
            "$prefix.pixel_array_size",
            characteristics.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)?.let {
                "${it.width}x${it.height}"
            } ?: "unknown",
        )
        writer.header(
            "$prefix.apertures",
            characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES).values(),
        )
        writer.header(
            "$prefix.focal_lengths_mm",
            characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS).values(),
        )
        writer.header(
            "$prefix.iso_range",
            characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)?.rangeValue()
                ?: "unknown",
        )
        writer.header(
            "$prefix.max_analog_iso",
            characteristics.get(CameraCharacteristics.SENSOR_MAX_ANALOG_SENSITIVITY) ?: "unknown",
        )
        writer.header(
            "$prefix.exposure_time_range_ns",
            characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)?.rangeValue()
                ?: "unknown",
        )
        writer.header(
            "$prefix.ae_fps_ranges",
            characteristics
                .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
                ?.joinToString(";") { it.rangeValue() }
                ?: "unknown",
        )
        if (Build.VERSION.SDK_INT >= 36) {
            writer.header(
                "$prefix.ae_priority_modes",
                characteristics
                    .get(CameraCharacteristics.CONTROL_AE_AVAILABLE_PRIORITY_MODES)
                    .values(),
            )
        }
        writer.header(
            "$prefix.capabilities",
            characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES).values(),
        )
        if (includePhysicalRequestKeys) {
            writer.header(
                "$prefix.physical_request_keys",
                runCatching {
                    characteristics.availablePhysicalCameraRequestKeys
                        .joinToString(";") { key -> key.name }
                        .ifEmpty { "none" }
                }.getOrElse { "unavailable" },
            )
        }
    }

    private fun readingLine(telemetry: CameraTelemetry): String = listOf(
        DateTimeFormatter.ISO_INSTANT.format(Instant.now()),
        telemetry.sensorTimestampNanoseconds,
        telemetry.width,
        telemetry.height,
        telemetry.exposureTimeNanoseconds,
        telemetry.frameDurationNanoseconds,
        telemetry.sensitivityIso,
        telemetry.framesPerSecond,
        telemetry.aeState,
        telemetry.appliedFrameRateRange?.rangeValue(),
        telemetry.lowLightBoostActive,
        telemetry.exposureControlMode.label,
        telemetry.requestedExposureTimeNanoseconds,
        telemetry.requestedSensitivityIso,
        telemetry.automaticMonochrome,
        telemetry.rollingStackFrameCount,
        telemetry.rollingStackBrightnessGain,
        telemetry.activePhysicalCameraId,
        telemetry.focalLengthMillimetres,
        telemetry.zoomRatio,
    ).joinToString(",") { value -> csvValue(value) }

    private fun apkSha256(): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(appContext.applicationInfo.sourceDir).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun BufferedWriter.header(key: String, value: Any) {
        append("# ")
        append(key)
        append('=')
        append(value.toString().replace('\n', ' '))
        newLine()
    }

    private fun csvValue(value: Any?): String {
        val text = value?.toString().orEmpty()
        return if (text.any { it == ',' || it == '"' || it == '\n' }) {
            "\"${text.replace("\"", "\"\"")}\""
        } else {
            text
        }
    }

    private fun Int.lensFacingValue(): String = when (this) {
        CameraCharacteristics.LENS_FACING_BACK -> "back"
        CameraCharacteristics.LENS_FACING_FRONT -> "front"
        CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
        else -> toString()
    }

    private fun Int.hardwareLevelValue(): String = when (this) {
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LEGACY -> "legacy"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_LIMITED -> "limited"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_FULL -> "full"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_3 -> "level_3"
        CameraCharacteristics.INFO_SUPPORTED_HARDWARE_LEVEL_EXTERNAL -> "external"
        else -> toString()
    }

    private fun <T : Comparable<T>> android.util.Range<T>.rangeValue(): String = "$lower-$upper"

    private fun FloatArray?.values(): String = this?.joinToString(";") ?: "unknown"

    private fun IntArray?.values(): String = this?.joinToString(";") ?: "unknown"

    private companion object {
        const val LOG_TAG = "CameraTelemetryLogger"
        const val LOG_FILENAME = "telemetry.csv"
        const val READING_INTERVAL_MILLISECONDS = 1_000L
    }
}
