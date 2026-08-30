package com.beddybytes.android.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.beddybytes.android.babystation.BabyStationUiState
import com.beddybytes.android.babystation.CameraOption
import com.beddybytes.android.babystation.MicrophoneOption

private val PreviewShape = RoundedCornerShape(16.dp)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Suppress("FunctionName")
@Composable
fun BabyStationScreen(
    uiState: BabyStationUiState,
    connectionMessage: String?,
    onNameChanged: (String) -> Unit,
    onCameraSelected: (String) -> Unit,
    onMicrophoneSelected: (Int) -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var cameraGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var microphoneGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestMultiplePermissions(),
        ) { grants ->
            cameraGranted = grants[Manifest.permission.CAMERA] ?: cameraGranted
            microphoneGranted = grants[Manifest.permission.RECORD_AUDIO] ?: microphoneGranted
        }
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    var screenSaverOpen by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        val missingPermissions =
            buildList {
                if (!cameraGranted) add(Manifest.permission.CAMERA)
                if (!microphoneGranted) add(Manifest.permission.RECORD_AUDIO)
            }
        if (missingPermissions.isNotEmpty()) {
            permissionLauncher.launch(missingPermissions.toTypedArray())
        }
    }

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        StationInformation(
            uiState = uiState,
            onSettingsClick = { settingsOpen = true },
        )
        Spacer(Modifier.height(12.dp))
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(PreviewShape)
                    .background(MaterialTheme.colorScheme.surface),
            contentAlignment = Alignment.Center,
        ) {
            val selectedCamera = uiState.selectedCamera
            if (cameraGranted && selectedCamera != null) {
                CameraPreview(
                    cameraId = selectedCamera.id,
                    grayscale = !uiState.running,
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                CameraPlaceholder(
                    cameraAvailable = selectedCamera != null,
                    onRequestCamera = {
                        permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
                    },
                )
            }

            if (uiState.running) {
                Row(
                    modifier =
                        Modifier
                            .align(Alignment.TopStart)
                            .padding(12.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color.Black.copy(alpha = 0.62f))
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(
                        Modifier
                            .size(9.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color(0xFFFF5B62)),
                    )
                    Text("Live", style = MaterialTheme.typography.labelLarge)
                }
            }

            connectionMessage?.let { message ->
                Text(
                    text = message,
                    modifier =
                        Modifier
                            .align(Alignment.TopCenter)
                            .padding(12.dp)
                            .clip(RoundedCornerShape(50))
                            .background(Color.Black.copy(alpha = 0.72f))
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        StationControls(
            running = uiState.running,
            microphoneGranted = microphoneGranted,
            namePresent = uiState.name.isNotBlank(),
            onRequestMicrophone = {
                permissionLauncher.launch(arrayOf(Manifest.permission.RECORD_AUDIO))
            },
            onStart = onStart,
            onStop = {
                screenSaverOpen = false
                onStop()
            },
            onScreenSaver = { screenSaverOpen = true },
        )
    }

    if (settingsOpen && !uiState.running) {
        ModalBottomSheet(onDismissRequest = { settingsOpen = false }) {
            StationSettings(
                uiState = uiState,
                onNameChanged = onNameChanged,
                onCameraSelected = onCameraSelected,
                onMicrophoneSelected = onMicrophoneSelected,
                onSignOut = onSignOut,
                onClose = { settingsOpen = false },
            )
        }
    }

    if (screenSaverOpen && uiState.running) {
        Surface(
            modifier =
                Modifier
                    .fillMaxSize()
                    .clickable { screenSaverOpen = false }
                    .semantics { contentDescription = "Screen saver. Tap to return." },
            color = Color.Black,
        ) {
            Box(contentAlignment = Alignment.BottomCenter) {
                Text(
                    text = "Tap to return",
                    modifier = Modifier.systemBarsPadding().padding(24.dp),
                    color = Color.White.copy(alpha = 0.4f),
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Suppress("FunctionName")
@Composable
private fun StationInformation(uiState: BabyStationUiState, onSettingsClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().height(64.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Outlined.Home,
            contentDescription = null,
            modifier = Modifier.size(28.dp),
        )
        Column(
            modifier = Modifier.weight(1f).padding(start = 12.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = uiState.name.ifBlank { "Unnamed station" },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                DeviceSummary(
                    icon = { Icon(Icons.Outlined.Mic, contentDescription = null) },
                    text = uiState.selectedMicrophone?.label ?: "No microphone",
                )
                DeviceSummary(
                    icon = { Icon(Icons.Outlined.Videocam, contentDescription = null) },
                    text = uiState.selectedCamera?.label ?: "No camera",
                )
            }
        }
        IconButton(
            onClick = onSettingsClick,
            enabled = !uiState.running,
        ) {
            Icon(Icons.Outlined.Settings, contentDescription = "Station settings")
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun DeviceSummary(icon: @Composable () -> Unit, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) { icon() }
        Text(
            text = text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Suppress("FunctionName")
@Composable
private fun CameraPlaceholder(cameraAvailable: Boolean, onRequestCamera: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            imageVector = Icons.Outlined.Videocam,
            contentDescription = null,
            modifier = Modifier.size(40.dp),
            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.64f),
        )
        Text(
            text = if (cameraAvailable) "Camera permission required" else "No camera available",
            modifier = Modifier.padding(top = 12.dp),
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f),
        )
        if (cameraAvailable) {
            TextButton(onClick = onRequestCamera) { Text("Allow camera") }
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun StationControls(
    running: Boolean,
    microphoneGranted: Boolean,
    namePresent: Boolean,
    onRequestMicrophone: () -> Unit,
    onStart: () -> Unit,
    onStop: () -> Unit,
    onScreenSaver: () -> Unit,
) {
    AnimatedContent(
        targetState = running,
        modifier = Modifier.fillMaxWidth().animateContentSize(),
        label = "station controls",
    ) { isRunning ->
        if (isRunning) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Button(onClick = onStop, modifier = Modifier.weight(1f).height(56.dp)) {
                    Text("Stop")
                }
                Button(
                    onClick = onScreenSaver,
                    modifier = Modifier.weight(1f).height(56.dp),
                    colors =
                        androidx.compose.material3.ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.secondary,
                        ),
                ) {
                    Text("Screen saver")
                }
            }
        } else if (microphoneGranted) {
            Button(
                onClick = onStart,
                enabled = namePresent,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) {
                Text("Start")
            }
        } else {
            Button(
                onClick = onRequestMicrophone,
                modifier = Modifier.fillMaxWidth().height(56.dp),
            ) {
                Text("Allow microphone")
            }
        }
    }
}

@Suppress("FunctionName")
@Composable
private fun StationSettings(
    uiState: BabyStationUiState,
    onNameChanged: (String) -> Unit,
    onCameraSelected: (String) -> Unit,
    onMicrophoneSelected: (Int) -> Unit,
    onSignOut: () -> Unit,
    onClose: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Station settings",
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
            )
            TextButton(onClick = onSignOut) { Text("Sign out") }
            IconButton(onClick = onClose) {
                Icon(Icons.Outlined.Close, contentDescription = "Close settings")
            }
        }
        OutlinedTextField(
            value = uiState.name,
            onValueChange = onNameChanged,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Name") },
            singleLine = true,
        )
        MicrophonePicker(
            selected = uiState.selectedMicrophone,
            options = uiState.microphones,
            onSelected = onMicrophoneSelected,
        )
        CameraPicker(
            selected = uiState.selectedCamera,
            options = uiState.cameras,
            onSelected = onCameraSelected,
        )
    }
}

@Suppress("FunctionName")
@Composable
private fun MicrophonePicker(
    selected: MicrophoneOption?,
    options: List<MicrophoneOption>,
    onSelected: (Int) -> Unit,
) {
    DevicePicker(
        label = "Microphone",
        selectedLabel = selected?.label ?: "No microphone",
        options = options,
        optionLabel = MicrophoneOption::label,
        onSelected = { onSelected(it.id) },
    )
}

@Suppress("FunctionName")
@Composable
private fun CameraPicker(
    selected: CameraOption?,
    options: List<CameraOption>,
    onSelected: (String) -> Unit,
) {
    DevicePicker(
        label = "Camera",
        selectedLabel = selected?.label ?: "No camera",
        options = options,
        optionLabel = CameraOption::label,
        onSelected = { onSelected(it.id) },
    )
}

@Suppress("FunctionName")
@Composable
private fun <T> DevicePicker(
    label: String,
    selectedLabel: String,
    options: List<T>,
    optionLabel: (T) -> String,
    onSelected: (T) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            modifier = Modifier.fillMaxWidth().clickable(enabled = options.isNotEmpty()) {
                expanded = true
            },
            enabled = options.isNotEmpty(),
            readOnly = true,
            label = { Text(label) },
            trailingIcon = {
                TextButton(
                    onClick = { expanded = true },
                    enabled = options.isNotEmpty(),
                ) {
                    Text("Choose")
                }
            },
            singleLine = true,
        )
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.fillMaxWidth(0.9f),
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(optionLabel(option)) },
                    onClick = {
                        onSelected(option)
                        expanded = false
                    },
                )
            }
        }
    }
}
