package org.qo.sdk.auth

import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object UrlUtils {
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

    fun normalizeServiceUrl(serviceUrl: String): String {
        return stripTicket(serviceUrl).trimEnd('/')
    }
}
