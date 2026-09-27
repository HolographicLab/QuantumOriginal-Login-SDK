package org.qo.sdk.auth

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/** Helpers for building CAS login URLs and processing service callbacks. */
object UrlUtils {
    /**
     * Builds a login portal URL with an encoded service callback and optional query parameters.
     *
     * @param authPortalUrl Login portal URL, such as `https://qoriginal.vip/login`.
     * @param serviceUrl Callback URL to bind to the login ticket.
     * @param extraParams Additional login portal query parameters.
     * @return The login portal URL.
     */
    fun buildLoginUrl(
        authPortalUrl: String,
        serviceUrl: String,
        extraParams: Map<String, String> = emptyMap(),
    ): String {
        val encodedService = URLEncoder.encode(serviceUrl, StandardCharsets.UTF_8)
        val separator = if (authPortalUrl.contains("?")) "&" else "?"
        val sb = StringBuilder(authPortalUrl).append(separator).append("service=").append(encodedService)

        for ((key, value) in extraParams) {
            sb.append("&")
                .append(URLEncoder.encode(key, StandardCharsets.UTF_8))
                .append("=")
                .append(URLEncoder.encode(value, StandardCharsets.UTF_8))
        }

        return sb.toString()
    }

    /**
     * Extracts the CAS `ticket` query parameter from a callback URL.
     *
     * @param urlString Callback URL to inspect.
     * @return The ticket value, or `null` when no ticket is present or the URL is invalid.
     */
    fun extractTicket(urlString: String?): String? {
        if (urlString.isNullOrBlank()) return null
        return runCatching {
            val uri = URI.create(urlString)
            val query = uri.rawQuery ?: return null
            query.split("&")
                .map { it.split("=", limit = 2) }
                .firstOrNull { it[0] == "ticket" && it.size > 1 }
                ?.get(1)
        }.getOrNull()
    }

    /**
     * Removes the CAS `ticket` query parameter from a callback URL.
     *
     * @param urlString Callback URL to clean.
     * @return The URL without its ticket, or the original input when it is invalid.
     */
    fun stripTicket(urlString: String?): String {
        if (urlString.isNullOrBlank()) return ""
        return runCatching {
            val uri = URI.create(urlString)
            val query = uri.rawQuery ?: return urlString
            val newQuery = query.split("&")
                .filterNot { it.startsWith("ticket=") || it == "ticket" }
                .joinToString("&")
                .ifEmpty { null }

            URI(
                uri.scheme,
                uri.authority,
                uri.path,
                newQuery,
                uri.fragment
            ).toString()
        }.getOrDefault(urlString)
    }

    /**
     * Removes the ticket and trailing slash before sending the service URL for validation.
     *
     * @param serviceUrl Service callback URL, optionally containing a ticket.
     * @return The normalized service URL.
     */
    fun normalizeServiceUrl(serviceUrl: String): String {
        return stripTicket(serviceUrl).trimEnd('/')
    }
}
