package com.beddybytes.android.authorization

import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AuthorizationRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var persistence: MemoryCookiePersistence
    private lateinit var repository: AuthorizationRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        persistence = MemoryCookiePersistence()
        val clock = AuthorizationClock { 1_000L }
        val cookieStore = RefreshCookieStore(persistence, clock)
        repository =
            DefaultAuthorizationRepository(
                apiBaseUrl = server.url("/").toString(),
                client = OkHttpClient.Builder().cookieJar(cookieStore).build(),
                refreshCookieStore = cookieStore,
                clock = clock,
            )
    }

    @After
    fun tearDown() {
        server.close()
    }

    @Test
    fun passwordGrantMatchesExistingBackendContract() {
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .addHeader("Content-Type: application/json")
                .addHeader("Set-Cookie: refresh_token=one; Max-Age=3600; Path=/token; HttpOnly")
                .body(tokenJson("access-one"))
                .build(),
        )

        kotlinx.coroutines.test.runTest {
            repository.signIn("parent@example.com", "password")
        }

        val request = server.takeRequest()
        assertEquals("/token", request.url.encodedPath)
        assertEquals(
            "grant_type=password&username=parent%40example.com&password=password",
            request.body?.utf8(),
        )
        assertEquals("one", persistence.value?.value)
    }

    @Test
    fun currentAccountIgnoresPasswordFieldsReturnedByBackend() {
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .addHeader("Content-Type: application/json")
                .body(
                    """{"id":"account-id","user":{"id":"user-id","email":"parent@example.com","password_salt":"salt","password_hash":"hash"}}""",
                ).build(),
        )

        lateinit var account: AccountSummary
        kotlinx.coroutines.test.runTest {
            account = repository.getCurrentAccount("access-token")
        }

        assertEquals(AccountSummary("account-id", "user-id", "parent@example.com"), account)
        assertEquals("Bearer access-token", server.takeRequest().headers["Authorization"])
    }

    @Test
    fun refreshSendsCurrentCookieAndPersistsRotationBeforeReturningToken() {
        persistence.value =
            PersistedRefreshCookie(
                name = "refresh_token",
                value = "one",
                expiresAt = 3_601_000L,
                domain = server.url("/").host,
                path = "/token",
                secure = false,
                httpOnly = true,
                hostOnly = true,
            )
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .addHeader("Content-Type: application/json")
                .addHeader("Set-Cookie: refresh_token=two; Max-Age=3600; Path=/token; HttpOnly")
                .body(tokenJson("access-two"))
                .build(),
        )

        lateinit var grant: AccessGrant
        kotlinx.coroutines.test.runTest {
            grant = repository.refresh()
        }

        val request = server.takeRequest()
        assertEquals("refresh_token=one", request.headers["Cookie"])
        assertEquals("two", persistence.value?.value)
        assertEquals("access-two", grant.accessToken)
    }

    @Test
    fun malformedTokenResponseIsUnavailableWithoutExposingItsBody() {
        server.enqueue(
            MockResponse.Builder()
                .code(200)
                .addHeader("Content-Type: application/json")
                .body("not a token")
                .build(),
        )

        lateinit var failure: Throwable
        kotlinx.coroutines.test.runTest {
            failure = runCatching { repository.refresh() }.exceptionOrNull()!!
        }

        assertTrue(failure is AuthorizationUnavailableException)
        assertFalseContains(failure, "not a token")
    }

    private fun tokenJson(accessToken: String) =
        """{"token_type":"Bearer","access_token":"$accessToken","expires_in":3600}"""

    private fun assertFalseContains(error: Throwable, secret: String) {
        assertTrue(error.toString().contains(secret).not())
        assertTrue(error.cause?.toString()?.contains(secret) != true)
    }

    private class MemoryCookiePersistence : RefreshCookiePersistence {
        var value: PersistedRefreshCookie? = null

        override fun load(): PersistedRefreshCookie? = value

        override fun save(cookie: PersistedRefreshCookie) {
            value = cookie
        }

        override fun clear() {
            value = null
        }
    }
}
