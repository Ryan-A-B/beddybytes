package com.beddybytes.android

import android.Manifest
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.beddybytes.android.mqtt.BabyStationSessionState
import com.beddybytes.android.mqtt.BabyStationStartRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class BabyStationService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val activeSession
        get() = (application as BeddyBytesApplication).container.activeBabyStationSession
    private lateinit var notificationManager: NotificationManager
    private var serviceStarted = false
    private var stationName = "Baby Station"

    private val screenReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                activeSession.recordEvent(
                    when (intent.action) {
                        Intent.ACTION_SCREEN_OFF -> "display_turned_off"
                        Intent.ACTION_SCREEN_ON -> "display_turned_on"
                        Intent.ACTION_USER_PRESENT -> "device_unlocked"
                        else -> return
                    },
                    deviceStateFields(),
                )
            }
        }

    override fun onCreate() {
        super.onCreate()
        notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                getString(R.string.baby_station_notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.baby_station_notification_channel_description)
                setShowBadge(false)
            },
        )
        registerReceiver(
            screenReceiver,
            IntentFilter().apply {
                addAction(Intent.ACTION_SCREEN_OFF)
                addAction(Intent.ACTION_SCREEN_ON)
                addAction(Intent.ACTION_USER_PRESENT)
            },
            Context.RECEIVER_NOT_EXPORTED,
        )
        serviceScope.launch {
            activeSession.state.collect { state ->
                if (!serviceStarted) return@collect
                if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
                ) {
                    notificationManager.notify(
                        NOTIFICATION_ID,
                        notification(state),
                    )
                }
                if (state == BabyStationSessionState.Ready ||
                    state is BabyStationSessionState.Failed
                ) {
                    serviceStarted = false
                    ServiceCompat.stopForeground(
                        this@BabyStationService,
                        ServiceCompat.STOP_FOREGROUND_REMOVE,
                    )
                    stopSelf()
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startSession(intent)

            ACTION_STOP -> {
                activeSession.stop(intent.getStringExtra(EXTRA_STOP_REASON) ?: "notification")
            }

            else -> stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        runCatching { unregisterReceiver(screenReceiver) }
        if (serviceStarted) activeSession.stop("service_destroyed")
        serviceStarted = false
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startSession(intent: Intent) {
        if (serviceStarted) return
        stationName = intent.getStringExtra(EXTRA_STATION_NAME).orEmpty().ifBlank { "Baby Station" }
        val request =
            BabyStationStartRequest(
                name = stationName,
                cameraId = intent.getStringExtra(EXTRA_CAMERA_ID),
                microphoneId =
                    intent
                        .getIntExtra(EXTRA_MICROPHONE_ID, NO_MICROPHONE_ID)
                        .takeUnless { it == NO_MICROPHONE_ID },
            )
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification(BabyStationSessionState.Connecting),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                if (request.cameraId != null) {
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                } else {
                    0
                },
        )
        serviceStarted = true
        activeSession.start(request)
        activeSession.recordEvent("foreground_service_started", deviceStateFields())
    }

    private fun notification(state: BabyStationSessionState): Notification {
        val contentIntent =
            PendingIntent.getActivity(
                this,
                CONTENT_REQUEST_CODE,
                Intent(this, MainActivity::class.java).addFlags(
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP,
                ),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val stopIntent =
            PendingIntent.getService(
                this,
                STOP_REQUEST_CODE,
                stopIntent(this, "notification"),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val status =
            when (state) {
                BabyStationSessionState.Connecting -> "Connecting"
                is BabyStationSessionState.Active -> "Monitoring"
                BabyStationSessionState.Reconnecting -> "Reconnecting"
                BabyStationSessionState.Stopping -> "Stopping"
                is BabyStationSessionState.Failed -> "Unable to monitor"
                BabyStationSessionState.Ready -> "Stopped"
            }
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(stationName)
            .setContentText(status)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(R.drawable.ic_launcher, getString(R.string.stop), stopIntent)
            .build()
    }

    private fun deviceStateFields(): Map<String, String> {
        val powerManager = getSystemService(PowerManager::class.java)
        val keyguardManager = getSystemService(KeyguardManager::class.java)
        return mapOf(
            "display_interactive" to powerManager.isInteractive.toString(),
            "device_locked" to keyguardManager.isKeyguardLocked.toString(),
        )
    }

    companion object {
        private const val ACTION_START = "com.beddybytes.android.action.START_BABY_STATION"
        private const val ACTION_STOP = "com.beddybytes.android.action.STOP_BABY_STATION"
        private const val EXTRA_STATION_NAME = "station_name"
        private const val EXTRA_CAMERA_ID = "camera_id"
        private const val EXTRA_MICROPHONE_ID = "microphone_id"
        private const val EXTRA_STOP_REASON = "stop_reason"
        private const val NO_MICROPHONE_ID = Int.MIN_VALUE
        private const val NOTIFICATION_CHANNEL_ID = "baby_station"
        private const val NOTIFICATION_ID = 101
        private const val CONTENT_REQUEST_CODE = 101
        private const val STOP_REQUEST_CODE = 102

        internal fun startIntent(context: Context, request: BabyStationStartRequest) =
            Intent(context, BabyStationService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_STATION_NAME, request.name)
                request.cameraId?.let { putExtra(EXTRA_CAMERA_ID, it) }
                request.microphoneId?.let { putExtra(EXTRA_MICROPHONE_ID, it) }
            }

        internal fun stopIntent(context: Context, reason: String) =
            Intent(context, BabyStationService::class.java).apply {
                action = ACTION_STOP
                putExtra(EXTRA_STOP_REASON, reason)
            }
    }
}
