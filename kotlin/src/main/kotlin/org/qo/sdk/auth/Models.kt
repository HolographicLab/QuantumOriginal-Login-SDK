package org.qo.sdk.auth

import kotlinx.serialization.Serializable

data class QoAuthConfig(
    val apiBaseUrl: String = "https://api.qoriginal.vip",
    val authPortalUrl: String = "https://app.qoriginal.vip/login",
    val defaultServiceUrl: String? = null,
)

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

open class QoAuthException(
    message: String,
    val code: String = "AUTH_ERROR",
    val statusCode: Int? = null,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

class TicketInvalidException(
    message: String = "The service ticket is invalid, expired, or mismatched."
) : QoAuthException(message, "INVALID_TICKET", 401)

class AccountFrozenException(
    message: String = "This QuantumOriginal account has been frozen."
) : QoAuthException(message, "ACCOUNT_FROZEN", 403)

class MissingServiceUrlException(
    message: String = "Service URL must be provided or configured."
) : QoAuthException(message, "MISSING_SERVICE_URL", 400)
