package com.beddybytes.android.authorization

import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.FormBody
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

internal interface AuthorizationRepository {
    fun hasRefreshSession(): Boolean

    suspend fun signIn(email: String, password: String): AccessGrant

    suspend fun refresh(): AccessGrant

    suspend fun getCurrentAccount(accessToken: String): AccountSummary

    fun clearRefreshSession()
}

internal class DefaultAuthorizationRepository(
    apiBaseUrl: String,
    private val client: OkHttpClient,
    private val refreshCookieStore: RefreshCookieStore,
    private val clock: AuthorizationClock,
    private val json: Json = Json { ignoreUnknownKeys = true },
) : AuthorizationRepository {
    private val baseUrl = apiBaseUrl.toHttpUrl()

    override fun hasRefreshSession(): Boolean = refreshCookieStore.hasUsableCookie()

    override suspend fun signIn(email: String, password: String): AccessGrant = requestToken(
        form =
            FormBody.Builder()
                .add("grant_type", "password")
                .add("username", email)
                .add("password", password)
                .build(),
    )

    override suspend fun refresh(): AccessGrant = requestToken(
        form =
            FormBody.Builder()
                .add("grant_type", "refresh_token")
                .build(),
    )

    override suspend fun getCurrentAccount(accessToken: String): AccountSummary =
        withContext(Dispatchers.IO) {
            val request =
                Request.Builder()
                    .url(endpoint("accounts/current"))
                    .header("Authorization", "Bearer $accessToken")
                    .get()
                    .build()
            execute(request).use { response ->
                requireSuccess(response)
                val account = decode<AccountDto>(response)
                val hasInvalidIdentity =
                    account.id.isBlank() ||
                        account.user.id.isBlank() ||
                        account.user.email.isBlank()
                if (hasInvalidIdentity) {
                    throw AuthorizationUnavailableException()
                }
                AccountSummary(
                    id = account.id,
                    userId = account.user.id,
                    email = account.user.email,
                )
            }
        }

    override fun clearRefreshSession() = refreshCookieStore.clear()

    private suspend fun requestToken(form: FormBody): AccessGrant = withContext(Dispatchers.IO) {
        val request =
            Request.Builder()
                .url(endpoint("token"))
                .post(form)
                .build()
        execute(request).use { response ->
            requireSuccess(response)
            val token = decode<TokenDto>(response)
            if (
                !token.tokenType.equals("bearer", ignoreCase = true) ||
                token.accessToken.isBlank() ||
                token.expiresIn <= 0
            ) {
                throw AuthorizationUnavailableException()
            }
            val now = clock.nowMillis()
            val expiresAt = now + token.expiresIn * 1_000L
            AccessGrant(
                accessToken = token.accessToken,
                expiresAtMillis = expiresAt,
                refreshAtMillis = expiresAt - ACCESS_TOKEN_GRACE_MILLIS,
            )
        }
    }

    private fun execute(request: Request): Response = try {
        client.newCall(request).execute()
    } catch (error: IOException) {
        throw AuthorizationUnavailableException(error)
    }

    private fun requireSuccess(response: Response) {
        if (response.isSuccessful) return
        if (response.code == 400 || response.code == 401) {
            throw AuthorizationRejectedException()
        }
        throw AuthorizationUnavailableException()
    }

    private inline fun <reified T> decode(response: Response): T = try {
        json.decodeFromString<T>(response.body.string())
    } catch (_: SerializationException) {
        throw AuthorizationUnavailableException()
    } catch (_: IllegalArgumentException) {
        throw AuthorizationUnavailableException()
    }

    private fun endpoint(relativePath: String): HttpUrl =
        baseUrl.resolve("/$relativePath") ?: throw IllegalArgumentException("Invalid API base URL")

    private companion object {
        const val ACCESS_TOKEN_GRACE_MILLIS = 5 * 60 * 1_000L
    }
}

internal fun interface AuthorizationClock {
    fun nowMillis(): Long
}

@Serializable
private data class TokenDto(
    @SerialName("token_type") val tokenType: String,
    @SerialName("access_token") val accessToken: String,
    @SerialName("expires_in") val expiresIn: Long,
)

@Serializable
private data class AccountDto(val id: String, val user: UserDto)

@Serializable
private data class UserDto(val id: String, val email: String)
