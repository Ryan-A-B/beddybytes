package com.beddybytes.android.authorization

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EncryptedRefreshCookiePersistenceTest {
    private val context get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Before
    fun clearStoredCookie() {
        clearPreferences()
    }

    @After
    fun removeTestCookie() {
        clearPreferences()
    }

    private fun clearPreferences() {
        context.getSharedPreferences("authorization_session", android.content.Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
    }

    @Test
    fun refreshCookieRoundTripsWithoutPlaintextStorage() {
        val persistence = EncryptedRefreshCookiePersistence(context)
        val cookie =
            PersistedRefreshCookie(
                name = "refresh_token",
                value = "highly-secret-value",
                expiresAt = Long.MAX_VALUE,
                domain = "api.beddybytes.local",
                path = "/token",
                secure = true,
                httpOnly = true,
                hostOnly = true,
            )

        persistence.save(cookie)

        assertEquals(cookie, persistence.load())
        val raw =
            context.getSharedPreferences(
                "authorization_session",
                android.content.Context.MODE_PRIVATE,
            )
                .all.values.joinToString()
        assertFalse(raw.contains(cookie.value))
    }
}
