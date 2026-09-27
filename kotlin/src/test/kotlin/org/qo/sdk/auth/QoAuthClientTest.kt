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
            HttpTransportResponse(200, mockResponse)
        }

        val client = QoAuthClient(
            config = QoAuthConfig(defaultServiceUrl = "https://ai.qoriginal.vip/callback"),
            transport = mockTransport
        )

        val user = client.validateTicket("ST-valid")
        assertEquals("Glowingstone", user.user)
        assertEquals(1294915648L, user.uid)
        assertEquals("token-test-64", user.token)
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
}
