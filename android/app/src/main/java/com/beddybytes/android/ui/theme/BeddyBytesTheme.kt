package com.beddybytes.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors =
    lightColorScheme(
        primary = Color(0xFF5846A6),
        secondary = Color(0xFF625B71),
        tertiary = Color(0xFF7D5260),
    )

private val DarkColors =
    darkColorScheme(
        primary = Color(0xFFC8BFFF),
        secondary = Color(0xFFCBC2DB),
        tertiary = Color(0xFFEFB8C8),
    )

@Suppress("FunctionName")
@Composable
fun BeddyBytesTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
