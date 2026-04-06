package com.neph.core.network

import com.neph.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.UnknownHostException

object JsonHttpClient {
    private const val ConnectTimeoutMillis = 15_000
    private const val ReadTimeoutMillis = 20_000

    suspend fun request(
        path: String,
        method: String = "GET",
        body: JSONObject? = null,
        token: String? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = (URL(buildUrl(path)).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = ConnectTimeoutMillis
            readTimeout = ReadTimeoutMillis
            doInput = true
            setRequestProperty("Accept", "application/json")

            if (!token.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer ${token.trim()}")
            }

            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
        }

        try {
            if (body != null) {
                connection.outputStream.use { output ->
                    output.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val raw = readText(
                if (status in 200..299) connection.inputStream else connection.errorStream
            )

            if (status !in 200..299) {
                throw buildApiException(status, raw)
            }

            if (raw.isBlank()) {
                return@withContext JSONObject()
            }

            try {
                JSONObject(raw)
            } catch (_: JSONException) {
                throw ApiException(
                    message = "Unexpected server response.",
                    status = status,
                    code = "INVALID_RESPONSE"
                )
            }
        } catch (error: ApiException) {
            throw error
        } catch (_: UnknownHostException) {
            throw ApiException(
                message = "Could not reach the server. Please check your connection and try again.",
                status = 0,
                code = "NETWORK_ERROR"
            )
        } catch (_: IOException) {
            throw ApiException(
                message = "Could not reach the server. Please check your connection and try again.",
                status = 0,
                code = "NETWORK_ERROR"
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun buildUrl(path: String): String {
        val normalizedBase = BuildConfig.API_BASE_URL.removeSuffix("/")
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        return "$normalizedBase$normalizedPath"
    }

    private fun readText(stream: java.io.InputStream?): String {
        if (stream == null) {
            return ""
        }

        return stream.bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    private fun buildApiException(status: Int, raw: String): ApiException {
        if (raw.isBlank()) {
            return ApiException(message = "Request failed.", status = status)
        }

        return try {
            val json = JSONObject(raw)
            ApiException(
                message = extractErrorMessage(json),
                status = status,
                code = json.optString("code").takeIf { it.isNotBlank() }
            )
        } catch (_: JSONException) {
            ApiException(message = raw.trim(), status = status)
        }
    }

    private fun extractErrorMessage(json: JSONObject): String {
        val directKeys = listOf("message", "detail", "error")
        for (key in directKeys) {
            val value = json.optString(key)
            if (value.isNotBlank()) {
                return value
            }
        }

        return "Request failed."
    }
}
