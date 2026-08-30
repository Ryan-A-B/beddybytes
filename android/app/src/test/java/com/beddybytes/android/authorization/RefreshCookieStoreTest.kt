package com.beddybytes.android.authorization

import okhttp3.Cookie
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RefreshCookieStoreTest {
    private val clock = MutableClock(1_000L)
    private val persistence = FakeCookiePersistence()
    private val store = RefreshCookieStore(persistence, clock)
    private val tokenUrl = "https://api.beddybytes.local/token".toHttpUrl()

    @Test
    fun savesAndReturnsOnlyRefreshCookieForMatchingRequest() {
        val unrelated = cookie(name = "other", value = "ignored")
        val refresh = cookie(name = "refresh_token", value = "secret")

        store.saveFromResponse(tokenUrl, listOf(unrelated, refresh))

        assertEquals("secret", store.loadForRequest(tokenUrl).single().value)
        assertTrue(store.loadForRequest("https://other.local/token".toHttpUrl()).isEmpty())
    }

    @Test
    fun expiredCookieIsCleared() {
        store.saveFromResponse(tokenUrl, listOf(cookie("refresh_token", "secret")))

        clock.value = 20_000L

        assertFalse(store.hasUsableCookie())
        assertEquals(null, persistence.value)
    }

    private fun cookie(name: String, value: String): Cookie = Cookie.Builder()
        .name(name)
        .value(value)
        .hostOnlyDomain("api.beddybytes.local")
        .path("/token")
        .expiresAt(10_000L)
        .secure()
        .httpOnly()
        .build()

    private class FakeCookiePersistence : RefreshCookiePersistence {
        var value: PersistedRefreshCookie? = null

        override fun load(): PersistedRefreshCookie? = value

        override fun save(cookie: PersistedRefreshCookie) {
            value = cookie
        }

        override fun clear() {
            value = null
        }
    }

    private class MutableClock(var value: Long) : AuthorizationClock {
        override fun nowMillis(): Long = value
    }
}
