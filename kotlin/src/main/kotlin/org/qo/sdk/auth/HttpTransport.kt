package org.qo.sdk.auth

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

data class HttpTransportResponse(
    val statusCode: Int,
    val body: String,
    val headers: Map<String, List<String>> = emptyMap(),
)

fun interface HttpTransport {
    fun postJson(url: String, headers: Map<String, String>, body: String): HttpTransportResponse
}

class DefaultJavaHttpTransport(
    private val client: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build()
) : HttpTransport {
    override fun postJson(url: String, headers: Map<String, String>, body: String): HttpTransportResponse {
        val requestBuilder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .timeout(Duration.ofSeconds(15))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))

        headers.forEach { (k, v) -> requestBuilder.header(k, v) }

        val response = client.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString())
        return HttpTransportResponse(
            statusCode = response.statusCode(),
            body = response.body(),
            headers = response.headers().map()
        )
    }
}
