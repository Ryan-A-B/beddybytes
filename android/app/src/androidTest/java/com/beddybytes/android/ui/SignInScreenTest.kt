package com.beddybytes.android.ui

import androidx.compose.ui.test.assertDoesNotExist
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.beddybytes.android.domain.BabyStationState
import com.beddybytes.android.ui.theme.BeddyBytesTheme
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class SignInScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Before
    fun setContent() {
        composeRule.setContent {
            BeddyBytesTheme {
                BeddyBytesApp(
                    state = BabyStationState.SignedOut,
                    onSignIn = { _, _ -> },
                )
            }
        }
    }

    @Test
    fun signInScreenDoesNotOfferBrowserActionsOrSubtitle() {
        composeRule.onNodeWithText("Native Baby Station").assertDoesNotExist()
        composeRule.onNodeWithText("Create account in browser").assertDoesNotExist()
        composeRule.onNodeWithText("Reset password in browser").assertDoesNotExist()
    }

    @Test
    fun passwordVisibilityCanBeToggled() {
        composeRule.onNodeWithText("Show").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Hide").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Show").assertIsDisplayed()
    }
}
