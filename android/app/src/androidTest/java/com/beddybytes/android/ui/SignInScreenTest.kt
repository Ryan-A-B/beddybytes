package com.beddybytes.android.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.beddybytes.android.authorization.AuthorizationState
import com.beddybytes.android.authorization.SignInUiState
import com.beddybytes.android.ui.theme.BeddyBytesTheme
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test

class SignInScreenTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Before
    fun setContent() {
        composeRule.setContent {
            var passwordVisible by remember { mutableStateOf(false) }
            BeddyBytesTheme {
                BeddyBytesApp(
                    uiState =
                        SignInUiState(
                            authorization = AuthorizationState.SignedOut(),
                            passwordVisible = passwordVisible,
                        ),
                    onEmailChanged = {},
                    onPasswordChanged = {},
                    onPasswordVisibilityChanged = { passwordVisible = !passwordVisible },
                    onSignIn = {},
                    onSignOut = {},
                )
            }
        }
    }

    @Test
    fun signInScreenDoesNotOfferBrowserActionsOrSubtitle() {
        assertTextAbsent("Native Baby Station")
        assertTextAbsent("Create account in browser")
        assertTextAbsent("Reset password in browser")
    }

    @Test
    fun passwordVisibilityCanBeToggled() {
        composeRule.onNodeWithText("Show").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Hide").assertIsDisplayed().performClick()
        composeRule.onNodeWithText("Show").assertIsDisplayed()
    }

    private fun assertTextAbsent(text: String) {
        assertTrue(composeRule.onAllNodesWithText(text).fetchSemanticsNodes().isEmpty())
    }
}
