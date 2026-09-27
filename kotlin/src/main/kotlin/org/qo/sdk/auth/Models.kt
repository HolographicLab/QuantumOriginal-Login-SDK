package org.qo.sdk.auth

import kotlinx.serialization.Serializable

/**
 * API, login portal, and service callback settings for [QoAuthClient].
 *
 * @property apiBaseUrl QAPI3 base URL. Defaults to `https://api.qoriginal.vip`.
 * @property authPortalUrl QuantumOriginal CAS login portal URL. Defaults to `https://qoriginal.vip/login`.
 * @property defaultServiceUrl Callback URL associated with login tickets.
 */
data class QoAuthConfig(
    val apiBaseUrl: String = "https://api.qoriginal.vip",
    val authPortalUrl: String = "https://qoriginal.vip/login",
    val defaultServiceUrl: String? = null,
)

/**
 * Authenticated account returned after a service ticket is validated.
 *
 * @property user Account name.
 * @property uid Numeric account identifier, when provided by QAPI3.
 * @property token API token for authenticated requests.
 * @property accountType QuantumOriginal account category.
 * @property score Account score.
 * @property frozen Whether the account is frozen.
 */
data class QoAuthUser(
    val user: String,
    val uid: Long?,
    val token: String,
    val accountType: String,
    val score: Int,
    val frozen: Boolean,
)

@Serializable
internal data class ServiceValidateAttributes(
    val score: Int = 0,
    val frozen: Boolean = false,
)

@Serializable
internal data class ServiceValidateResponseBody(
    val success: Boolean = false,
    val user: String? = null,
    val uid: Long? = null,
    val token: String? = null,
    val accountType: String? = null,
    val attributes: ServiceValidateAttributes? = null,
    val code: String? = null,
    val message: String? = null,
)

/**
 * Base exception raised by the authentication SDK.
 *
 * @property code Machine-readable error code.
 * @property statusCode HTTP status associated with the error, when available.
 */
open class QoAuthException(
    message: String,
    val code: String = "AUTH_ERROR",
    val statusCode: Int? = null,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/** Thrown when a service ticket is invalid, expired, or bound to another service. */
class TicketInvalidException(
    message: String = "The service ticket is invalid, expired, or mismatched."
) : QoAuthException(message, "INVALID_TICKET", 401)

/** Thrown when the authenticated QuantumOriginal account is frozen. */
class AccountFrozenException(
    message: String = "This QuantumOriginal account has been frozen."
) : QoAuthException(message, "ACCOUNT_FROZEN", 403)

/** Thrown when no service callback URL is supplied or configured. */
class MissingServiceUrlException(
    message: String = "Service URL must be provided or configured."
) : QoAuthException(message, "MISSING_SERVICE_URL", 400)
