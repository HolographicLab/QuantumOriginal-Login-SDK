package org.qo.sdk.auth

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Client for QuantumOriginal CAS sign-in and QAPI3 ticket validation.
 *
 * The default token storage is in-memory. Supply a persistent [TokenStorage] implementation
 * if tokens must survive beyond this client's lifetime.
 */
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

    /**
     * Builds the QuantumOriginal login URL for the configured or supplied callback URL.
     *
     * @param serviceUrl Callback URL to associate with the ticket.
     * @param extraParams Additional login portal query parameters.
     * @return The URL to which the user should be redirected.
     * @throws MissingServiceUrlException If no callback URL is supplied or configured.
     */
    fun getLoginUrl(serviceUrl: String? = null, extraParams: Map<String, String> = emptyMap()): String {
        val targetService = resolveServiceUrl(serviceUrl)
        return UrlUtils.buildLoginUrl(config.authPortalUrl, targetService, extraParams)
    }

    /**
     * Validates a one-time CAS service ticket with QAPI3 and stores the returned API token.
     *
     * @param ticket Ticket received by the service callback.
     * @param serviceUrl Callback URL bound to the ticket.
     * @return The authenticated user and account attributes.
     * @throws QoAuthException If the ticket is empty, invalid, or validation fails.
     */
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

    /** Returns the API token saved in [storage], or `null` when none is available. */
    fun getToken(): String? = storage.get("token")

    /**
     * Saves an API token or removes it when `null` or blank.
     *
     * @param token Token to save, or `null` to clear.
     */
    fun setToken(token: String?) {
        if (token.isNullOrBlank()) {
            storage.remove("token")
        } else {
            storage.set("token", token)
        }
    }

    /** Clears the locally stored API token. */
    fun logout() {
        setToken(null)
    }

    /**
     * Builds an authorization header using the supplied token or the stored token.
     *
     * @param token Optional token to use instead of the stored token.
     * @return An authorization header map, or an empty map when no token is available.
     */
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
