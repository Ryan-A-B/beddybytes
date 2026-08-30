package com.beddybytes.android.authorization

import android.annotation.SuppressLint
import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

internal class RefreshCookieStore(
    private val persistence: RefreshCookiePersistence,
    private val clock: AuthorizationClock,
) : CookieJar {
    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val cookie = cookies.lastOrNull { it.name == REFRESH_COOKIE_NAME } ?: return
        if (cookie.expiresAt <= clock.nowMillis()) {
            persistence.clear()
        } else if (cookie.matches(url)) {
            persistence.save(PersistedRefreshCookie.from(cookie))
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val cookie = persistence.load()?.toCookie() ?: return emptyList()
        if (cookie.expiresAt <= clock.nowMillis()) {
            persistence.clear()
            return emptyList()
        }
        return if (cookie.matches(url)) listOf(cookie) else emptyList()
    }

    fun hasUsableCookie(): Boolean {
        val cookie = persistence.load()?.toCookie() ?: return false
        if (cookie.expiresAt <= clock.nowMillis()) {
            persistence.clear()
            return false
        }
        return true
    }

    fun clear() = persistence.clear()

    private companion object {
        const val REFRESH_COOKIE_NAME = "refresh_token"
    }
}

internal interface RefreshCookiePersistence {
    fun load(): PersistedRefreshCookie?

    fun save(cookie: PersistedRefreshCookie)

    fun clear()
}

@Serializable
internal data class PersistedRefreshCookie(
    val name: String,
    val value: String,
    val expiresAt: Long,
    val domain: String,
    val path: String,
    val secure: Boolean,
    val httpOnly: Boolean,
    val hostOnly: Boolean,
) {
    fun toCookie(): Cookie = Cookie.Builder()
        .name(name)
        .value(value)
        .expiresAt(expiresAt)
        .path(path)
        .apply {
            if (hostOnly) hostOnlyDomain(domain) else domain(domain)
            if (secure) secure()
            if (httpOnly) httpOnly()
        }.build()

    companion object {
        fun from(cookie: Cookie): PersistedRefreshCookie = PersistedRefreshCookie(
            name = cookie.name,
            value = cookie.value,
            expiresAt = cookie.expiresAt,
            domain = cookie.domain,
            path = cookie.path,
            secure = cookie.secure,
            httpOnly = cookie.httpOnly,
            hostOnly = cookie.hostOnly,
        )
    }
}

@SuppressLint("ApplySharedPref", "UseKtx")
internal class EncryptedRefreshCookiePersistence(context: Context, private val json: Json = Json) :
    RefreshCookiePersistence {
    private val preferences =
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    @Synchronized
    override fun load(): PersistedRefreshCookie? {
        val encoded = preferences.getString(COOKIE_KEY, null) ?: return null
        return try {
            val parts = encoded.split('.', limit = 2)
            require(parts.size == 2)
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val encrypted = Base64.decode(parts[1], Base64.NO_WRAP)
            val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            cipher.updateAAD(ASSOCIATED_DATA)
            json.decodeFromString<PersistedRefreshCookie>(
                cipher.doFinal(encrypted).decodeToString(),
            )
        } catch (_: GeneralSecurityException) {
            recoverFromUnreadableValue()
            null
        } catch (_: IllegalArgumentException) {
            recoverFromUnreadableValue()
            null
        }
    }

    @Synchronized
    override fun save(cookie: PersistedRefreshCookie) {
        try {
            val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            cipher.updateAAD(ASSOCIATED_DATA)
            val encrypted = cipher.doFinal(json.encodeToString(cookie).encodeToByteArray())
            val encoded =
                Base64.encodeToString(cipher.iv, Base64.NO_WRAP) +
                    "." +
                    Base64.encodeToString(encrypted, Base64.NO_WRAP)
            check(preferences.edit().putString(COOKIE_KEY, encoded).commit())
        } catch (error: GeneralSecurityException) {
            throw IllegalStateException("Unable to protect the refresh session", error)
        }
    }

    @Synchronized
    override fun clear() {
        check(preferences.edit().remove(COOKIE_KEY).commit())
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }

    private fun recoverFromUnreadableValue() {
        preferences.edit().remove(COOKIE_KEY).commit()
        runCatching {
            KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }.deleteEntry(KEY_ALIAS)
        }
    }

    private companion object {
        const val PREFERENCES_NAME = "authorization_session"
        const val COOKIE_KEY = "refresh_cookie"
        const val KEY_ALIAS = "beddybytes_refresh_cookie_v1"
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_TAG_BITS = 128
        val ASSOCIATED_DATA = "com.beddybytes.android.refresh-cookie.v1".encodeToByteArray()
    }
}
