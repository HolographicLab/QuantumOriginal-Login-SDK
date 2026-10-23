package org.qo.sdk.auth

import kotlin.test.*

class QoAuthClientTest {

    @Test
    fun `default config uses QuantumOriginal login portal`() {
        assertEquals("https://qoriginal.vip/login", QoAuthConfig().authPortalUrl)
    }

    @Test
    fun `buildLoginUrl produces correct URL with service and query parameters`() {
        val url = UrlUtils.buildLoginUrl(
            authPortalUrl = "https://qoriginal.vip/login",
            serviceUrl = "https://ai.qoriginal.vip/callback",
            extraParams = mapOf("theme" to "dark")
        )
        assertTrue(url.startsWith("https://qoriginal.vip/login?service="))
        assertTrue(url.contains("https%3A%2F%2Fai.qoriginal.vip%2Fcallback"))
        assertTrue(url.contains("theme=dark"))
    }

    @Test
    fun `extractTicket and stripTicket work properly`() {
        val original = "https://ai.qoriginal.vip/callback?foo=bar&ticket=ST-abc123xyz&lang=zh"
        val ticket = UrlUtils.extractTicket(original)
        assertEquals("ST-abc123xyz", ticket)

        val stripped = UrlUtils.stripTicket(original)
        assertFalse(stripped.contains("ticket="))
        assertTrue(stripped.contains("foo=bar"))
        assertTrue(stripped.contains("lang=zh"))
    }

    @Test
    fun `validateTicket succeeds with valid JSON response`() {
        val mockResponse = """
            {
                "success": true,
                "user": "Glowingstone",
                "uid": 1294915648,
                "token": "token-test-64",
                "clientId": "qmod",
                "accountType": "qo",
                "attributes": {
                    "score": 10,
                    "frozen": false
                }
            }
        """.trimIndent()

        val mockTransport = HttpTransport { url, _, body ->
            assertEquals("https://api.qoriginal.vip/qo/auth/serviceValidate", url)
            assertTrue(body.contains("ST-valid"))
            assertTrue(body.contains("https://ai.qoriginal.vip/callback"))
            assertTrue(body.contains("\"clientId\":\"qmod\""))
            HttpTransportResponse(200, mockResponse)
        }

        val client = QoAuthClient(
            config = QoAuthConfig(
                defaultServiceUrl = "https://ai.qoriginal.vip/callback",
                clientId = "qmod",
            ),
            transport = mockTransport
        )

        val user = client.validateTicket("ST-valid")
        assertEquals("Glowingstone", user.user)
        assertEquals(1294915648L, user.uid)
        assertEquals("token-test-64", user.token)
        assertEquals("qmod", user.clientId)
        assertEquals("qo", user.accountType)
        assertEquals(10, user.score)
        assertFalse(user.frozen)

        assertEquals("token-test-64", client.getToken())
        val headers = client.buildAuthenticatedHeaders()
        assertEquals("Bearer token-test-64", headers["Authorization"])
    }

    @Test
    fun `validateTicket throws TicketInvalidException on 401`() {
        val errorResponse = """
            {
                "success": false,
                "code": "INVALID_TICKET",
                "message": "The ticket has expired."
            }
        """.trimIndent()

        val mockTransport = HttpTransport { _, _, _ ->
            HttpTransportResponse(401, errorResponse)
        }

        val client = QoAuthClient(
            config = QoAuthConfig(defaultServiceUrl = "https://ai.qoriginal.vip/callback"),
            transport = mockTransport
        )

        val ex = assertFailsWith<TicketInvalidException> {
            client.validateTicket("ST-invalid")
        }
        assertEquals("INVALID_TICKET", ex.code)
    }

    @Test
    fun `validateTicket throws AccountFrozenException on 403`() {
        val errorResponse = """
            {
                "success": false,
                "code": "ACCOUNT_FROZEN",
                "message": "Account frozen"
            }
        """.trimIndent()

        val mockTransport = HttpTransport { _, _, _ ->
            HttpTransportResponse(403, errorResponse)
        }

        val client = QoAuthClient(
            config = QoAuthConfig(defaultServiceUrl = "https://ai.qoriginal.vip/callback"),
            transport = mockTransport
        )

        val ex = assertFailsWith<AccountFrozenException> {
            client.validateTicket("ST-frozen")
        }
        assertEquals("ACCOUNT_FROZEN", ex.code)
    }

    @Test
    fun `refreshSession updates the saved account and token source`() {
        val responseBody = """
            {
                "success": true,
                "user": "Glowingstone",
                "uid": 1294915648,
                "token": "refreshed-token",
                "clientId": "qmod",
                "accountType": "qo",
                "attributes": {
                    "score": 10,
                    "frozen": false
                }
            }
        """.trimIndent()
        val mockTransport = HttpTransport { url, headers, body ->
            assertEquals("https://api.qoriginal.vip/qo/auth/session/refresh", url)
            assertEquals("old-token", headers["Authorization"])
            assertEquals("{}", body)
            HttpTransportResponse(200, responseBody)
        }
        val client = QoAuthClient(
            storage = MemoryTokenStorage(),
            transport = mockTransport,
        )
        client.setToken("old-token")

        val user = client.refreshSession()

        assertEquals("Glowingstone", user.user)
        assertEquals("refreshed-token", user.token)
        assertEquals("qmod", user.clientId)
        assertEquals("refreshed-token", client.getToken())
    }

    @Test
    fun `refresh failures preserve credentials and distinguish temporary errors`() {
        for ((status, code) in listOf(401 to "INVALID_TOKEN", 403 to "ACCOUNT_FROZEN", 503 to "REFRESH_FAILED")) {
            val client = QoAuthClient(
                storage = MemoryTokenStorage(),
                transport = HttpTransport { _, _, _ -> HttpTransportResponse(status, "{\"success\":false}") },
            )
            client.setToken("old-token")
            val error = assertFailsWith<QoAuthException> { client.refreshSession() }
            assertEquals(code, error.code)
            assertEquals("old-token", client.getToken())
        }
    }

    @Test
    fun `refresh rejects missing sessions and incomplete account data`() {
        val client = QoAuthClient(
            storage = MemoryTokenStorage(),
            transport = HttpTransport { _, _, _ -> HttpTransportResponse(200, "{\"success\":true}") },
        )
        assertFailsWith<SessionInvalidException> { client.refreshSession() }
        client.setToken("old-token")
        val error = assertFailsWith<QoAuthException> { client.refreshSession() }
        assertEquals("INVALID_RESPONSE", error.code)
        assertEquals("old-token", client.getToken())
    }
}
