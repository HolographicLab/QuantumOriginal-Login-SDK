package org.qo.sdk.auth

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

class QoAuthClient(
    val config: QoAuthConfig = QoAuthConfig(),
    val storage: TokenStorage = MemoryTokenStorage(),
    private val transport: HttpTransport = DefaultJavaHttpTransport(),
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    private val apiBaseUrl = config.apiBaseUrl.trimEnd('/')

    fun getLoginUrl(serviceUrl: String? = null, extraParams: Map<String, String> = emptyMap()): String {
        val targetService = resolveServiceUrl(serviceUrl)
        return UrlUtils.buildLoginUrl(config.authPortalUrl, targetService, extraParams)
    }

    fun validateTicket(ticket: String, serviceUrl: String? = null): QoAuthUser {
        val cleanTicket = ticket.trim()
        if (cleanTicket.isEmpty()) {
            throw QoAuthException("Ticket cannot be empty", "EMPTY_TICKET", 400)
        }

        val targetService = UrlUtils.normalizeServiceUrl(resolveServiceUrl(serviceUrl))
        val endpoint = "$apiBaseUrl/qo/auth/serviceValidate"

        val requestBody = buildJsonObject {
            put("ticket", cleanTicket)
            put("service", targetService)
        }.toString()

        val response = transport.postJson(endpoint, emptyMap(), requestBody)

        val parsed = runCatching {
            json.decodeFromString<ServiceValidateResponseBody>(response.body)
        }.getOrElse { error ->
            throw QoAuthException(
                "Failed to parse validation response: ${error.message}",
                "PARSE_ERROR",
                response.statusCode,
                error
            )
        }

        if (response.statusCode != 200 || !parsed.success) {
            when {
                response.statusCode == 403 || parsed.code == "ACCOUNT_FROZEN" ->
                    throw AccountFrozenException(parsed.message ?: "Account is frozen")
                response.statusCode == 401 || parsed.code == "INVALID_TICKET" ->
                    throw TicketInvalidException(parsed.message ?: "Invalid or expired ticket")
                else ->
                    throw QoAuthException(
                        parsed.message ?: "Ticket validation failed",
                        parsed.code ?: "VALIDATION_FAILED",
                        response.statusCode
                    )
            }
        }

        val user = QoAuthUser(
            user = parsed.user ?: "",
            uid = parsed.uid,
            token = parsed.token ?: "",
            accountType = parsed.accountType ?: "qo",
            score = parsed.attributes?.score ?: 0,
            frozen = parsed.attributes?.frozen ?: false
        )

        setToken(user.token)
        return user
    }

    fun getToken(): String? = storage.get("token")

    fun setToken(token: String?) {
        if (token.isNullOrBlank()) {
            storage.remove("token")
        } else {
            storage.set("token", token)
        }
    }

    fun logout() {
        setToken(null)
    }

    fun buildAuthenticatedHeaders(token: String? = null): Map<String, String> {
        val activeToken = token ?: getToken() ?: return emptyMap()
        return mapOf("Authorization" to "Bearer $activeToken")
    }

    private fun resolveServiceUrl(overrideUrl: String?): String {
        return overrideUrl
            ?: config.defaultServiceUrl
            ?: throw MissingServiceUrlException()
    }
}
