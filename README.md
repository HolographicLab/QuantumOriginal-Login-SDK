# QuantumOriginal Login SDK

Unified SSO/CAS authentication clients for the QuantumOriginal ecosystem, with TypeScript/JavaScript and Kotlin implementations.

| Service | URL |
| --- | --- |
| Login portal | `https://qoriginal.vip/login` |
| QAPI3 base URL | `https://api.qoriginal.vip` |
| Ticket validation endpoint | `https://api.qoriginal.vip/qo/auth/serviceValidate` |

The login portal uses the `qoriginal.vip` domain. The API remains on `api.qoriginal.vip`.

## Features

- Build a CAS login URL with a service callback URL.
- Validate a one-time service ticket and retrieve the authenticated user and API token.
- Attach the stored token to TypeScript API requests or build authenticated request headers in Kotlin.
- Use the TypeScript SDK in browsers or Node.js, and the Kotlin SDK on the JVM.

## Project layout

```text
quantumoriginal-login-sdk/
├── ts/                    # TypeScript / JavaScript SDK
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   └── test/
└── kotlin/                # Kotlin/JVM SDK
    ├── build.gradle.kts
    └── src/
        ├── main/kotlin/org/qo/sdk/auth/
        └── test/kotlin/org/qo/sdk/auth/
```

## TypeScript / JavaScript

The TypeScript SDK has no runtime dependencies and uses the Fetch API. It supports browsers and Node.js 18 or later.

### Install

```bash
npm install @quantumoriginal/login-sdk
```

### Browser login flow

Configure the service callback URL used by your application. On the callback route, `handleCallback()` validates a `ticket` query parameter and stores the returned user and token. If no ticket is present and there is no saved token, redirect the browser to the login portal.

```typescript
import { QoAuthClient } from '@quantumoriginal/login-sdk';

const auth = new QoAuthClient({
  apiBaseUrl: 'https://api.qoriginal.vip',
  authPortalUrl: 'https://qoriginal.vip/login',
  serviceUrl: 'https://ai.example.com/auth/callback',
});

async function initializeAuth() {
  const user = await auth.handleCallback();
  if (user) {
    console.log(`Logged in as ${user.user}`);
    return user;
  }

  if (!(await auth.getToken())) {
    auth.redirectToLogin();
  }

  return null;
}
```

`getLoginUrl()` returns the login URL without navigating, which is useful when the application manages navigation itself. In non-browser environments, provide `serviceUrl` in the configuration or pass it to `getLoginUrl()` / `validateTicket()`.

### Authenticated requests and logout

`authenticatedFetch()` adds the stored token to the request unless the request already has an `Authorization` header. `logout()` clears the SDK's locally stored user and token; it does not invalidate a session at the login portal.

```typescript
const response = await auth.authenticatedFetch(
  'https://api.qoriginal.vip/qo/authorization/account'
);
const account = await response.json();

await auth.logout();
```

By default, tokens and user data use `localStorage` when it is available and in-memory storage otherwise. Supply a `TokenStorage` implementation through `storage` to change this behavior.

## Kotlin/JVM

The Kotlin SDK uses the JDK HTTP client and supports a pluggable `HttpTransport`. The Gradle build targets JDK 21.

### Gradle dependencies

```kotlin
dependencies {
    implementation("org.qo.sdk:quantumoriginal-login-sdk:1.0.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
}
```

### Create a login URL and validate a ticket

The Kotlin SDK returns the login URL but does not open a browser or host the callback endpoint. The integrating application is responsible for redirecting the user and extracting the `ticket` from its callback request.

```kotlin
import org.qo.sdk.auth.QoAuthClient
import org.qo.sdk.auth.QoAuthConfig

val client = QoAuthClient(
    config = QoAuthConfig(
        apiBaseUrl = "https://api.qoriginal.vip",
        authPortalUrl = "https://qoriginal.vip/login",
        defaultServiceUrl = "https://kotshi.example.com/auth/callback"
    )
)

// Redirect the user to this URL using your application or web framework.
val loginUrl = client.getLoginUrl()

// After the callback, validate the ticket received by your application.
val user = client.validateTicket("ST-example-ticket-xxxx")
println("Authenticated user: ${user.user}, UID: ${user.uid}")

val headers = client.buildAuthenticatedHeaders()
```

The default Kotlin token storage is in-memory. Provide your own `TokenStorage` implementation when tokens need to persist beyond the lifetime of the client.

## Service tickets and errors

- A service ticket is one-time and bound to the requested `service` callback URL. Use the same callback URL when creating the login URL and validating the ticket.
- TypeScript exposes `TicketInvalidError`, `AccountFrozenError`, and the base `QoAuthError`. Kotlin exposes corresponding exception types.
- Handle ticket-validation failures in the application and avoid logging tickets or access tokens.

## License

MIT © 2026 Quantum Original
