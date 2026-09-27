import { createDefaultStorage } from './storage.js';
import {
  AccountFrozenError,
  QoAuthConfig,
  QoAuthError,
  QoAuthUser,
  ServiceValidateResponse,
  TicketInvalidError,
  TokenStorage,
} from './types.js';
import {
  buildLoginUrl,
  extractTicketFromUrl,
  normalizeServiceUrl,
  stripTicketFromUrl,
} from './utils.js';

/**
 * Client for QuantumOriginal CAS sign-in, ticket validation, and authenticated API requests.
 */
export class QoAuthClient {
  public readonly apiBaseUrl: string;
  public readonly authPortalUrl: string;
  public readonly defaultServiceUrl?: string;
  public readonly storage: TokenStorage;
  private readonly customFetch: typeof fetch;

  /**
   * Creates a client with the QuantumOriginal API and login portal defaults.
   *
   * @param config API endpoints, service callback URL, storage, and optional Fetch implementation.
   */
  constructor(config: QoAuthConfig = {}) {
    this.apiBaseUrl = (config.apiBaseUrl ?? 'https://api.qoriginal.vip').replace(
      /\/+$/,
      ''
    );
    this.authPortalUrl =
      config.authPortalUrl ?? 'https://qoriginal.vip/login';
    this.defaultServiceUrl = config.serviceUrl;
    this.storage = config.storage ?? createDefaultStorage();
    this.customFetch = config.fetch ?? fetch.bind(globalThis);
  }

  /**
   * Builds the QuantumOriginal login URL with the service callback parameter.
   *
   * @param serviceUrl Callback URL to associate with the ticket. Defaults to the configured
   * service URL or, in a browser, the current URL without its ticket.
   * @param extraParams Additional login portal query parameters.
   * @returns The URL to which the user should be redirected.
   */
  public getLoginUrl(
    serviceUrl?: string,
    extraParams?: Record<string, string>
  ): string {
    const targetService = this.resolveServiceUrl(serviceUrl);
    return buildLoginUrl(this.authPortalUrl, targetService, extraParams);
  }

  /**
   * Redirects the current browser window to the QuantumOriginal login portal.
   *
   * @param serviceUrl Callback URL to associate with the ticket.
   * @param extraParams Additional login portal query parameters.
   * @throws {QoAuthError} If called outside a browser environment.
   */
  public redirectToLogin(
    serviceUrl?: string,
    extraParams?: Record<string, string>
  ): void {
    if (typeof window === 'undefined') {
      throw new QoAuthError(
        'redirectToLogin can only be called in a browser environment.',
        'BROWSER_REQUIRED'
      );
    }
    window.location.href = this.getLoginUrl(serviceUrl, extraParams);
  }

  /**
   * Validates a CAS service ticket with QAPI3 and saves the returned user and token.
   *
   * @param ticket One-time ticket received on the service callback.
   * @param serviceUrl Callback URL bound to the ticket.
   * @returns The authenticated user and API token.
   * @throws {QoAuthError} If the ticket is empty or validation fails.
   */
  public async validateTicket(
    ticket: string,
    serviceUrl?: string
  ): Promise<QoAuthUser> {
    const cleanTicket = ticket.trim();
    if (!cleanTicket) {
      throw new QoAuthError('Ticket cannot be empty.', 'EMPTY_TICKET', 400);
    }

    const targetService = normalizeServiceUrl(this.resolveServiceUrl(serviceUrl));
    const endpoint = `${this.apiBaseUrl}/qo/auth/serviceValidate`;

    const response = await this.customFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticket: cleanTicket,
        service: targetService,
      }),
    });

    const data = (await response.json()) as ServiceValidateResponse;

    if (!response.ok || !data.success) {
      if (response.status === 403 || (data as any)?.code === 'ACCOUNT_FROZEN') {
        throw new AccountFrozenError(
          (data as any)?.message ?? 'This account is frozen.'
        );
      }
      if (response.status === 401 || (data as any)?.code === 'INVALID_TICKET') {
        throw new TicketInvalidError(
          (data as any)?.message ?? 'Invalid or expired ticket.'
        );
      }
      throw new QoAuthError(
        (data as any)?.message ?? 'Ticket validation failed.',
        (data as any)?.code ?? 'VALIDATION_FAILED',
        response.status
      );
    }

    const user: QoAuthUser = {
      user: data.user,
      uid: data.uid,
      token: data.token,
      accountType: data.accountType,
      attributes: {
        score: data.attributes.score,
        frozen: data.attributes.frozen,
      },
    };

    await this.setToken(user.token);
    await this.setUser(user);

    return user;
  }

  /**
   * Automatically inspects current window URL for a `?ticket=ST-xxxx` parameter,
   * validates it, removes the ticket from the address bar, and returns the authenticated user.
   *
   * @param options Callback URL override and option to keep the ticket in the address bar.
   * @returns The authenticated user, or `null` when no ticket is present or when called outside a browser.
   */
  public async handleCallback(options?: {
    serviceUrl?: string;
    stripTicket?: boolean;
  }): Promise<QoAuthUser | null> {
    if (typeof window === 'undefined') return null;

    const ticket = extractTicketFromUrl(window.location.href);
    if (!ticket) return null;

    const serviceUrl = options?.serviceUrl ?? window.location.href;
    const user = await this.validateTicket(ticket, serviceUrl);

    if (options?.stripTicket !== false && typeof window.history !== 'undefined') {
      const cleanUrl = stripTicketFromUrl(window.location.href);
      window.history.replaceState({}, document.title, cleanUrl);
    }

    return user;
  }

  /**
   * Reads the API token from the configured storage.
   *
   * @returns The saved token, or `null` when no token is stored.
   */
  public async getToken(): Promise<string | null> {
    return await this.storage.getItem('token');
  }

  /**
   * Saves an API token or removes it when passed `null`.
   *
   * @param token Token to save, or `null` to clear it.
   */
  public async setToken(token: string | null): Promise<void> {
    if (token) {
      await this.storage.setItem('token', token);
    } else {
      await this.storage.removeItem('token');
    }
  }

  /**
   * Reads the saved authenticated user from storage.
   *
   * @returns The saved user, or `null` when no valid user is stored.
   */
  public async getUser(): Promise<QoAuthUser | null> {
    const raw = await this.storage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as QoAuthUser;
    } catch {
      return null;
    }
  }

  /**
   * Saves an authenticated user or removes it when passed `null`.
   *
   * @param user User to save, or `null` to clear it.
   */
  public async setUser(user: QoAuthUser | null): Promise<void> {
    if (user) {
      await this.storage.setItem('user', JSON.stringify(user));
    } else {
      await this.storage.removeItem('user');
    }
  }

  /**
   * Clears the locally stored user and token, then optionally redirects the browser.
   *
   * @param redirectUrl Optional URL to open after local credentials are cleared.
   */
  public async logout(redirectUrl?: string): Promise<void> {
    await this.setToken(null);
    await this.setUser(null);
    if (redirectUrl && typeof window !== 'undefined') {
      window.location.href = redirectUrl;
    }
  }

  /**
   * Sends an HTTP request with `Authorization: Bearer <token>` automatically attached.
   */
  public async authenticatedFetch(
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> {
    const token = await this.getToken();
    const headers = new Headers(init.headers);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return this.customFetch(input, {
      ...init,
      headers,
    });
  }

  private resolveServiceUrl(overrideUrl?: string): string {
    if (overrideUrl) return overrideUrl;
    if (this.defaultServiceUrl) return this.defaultServiceUrl;
    if (typeof window !== 'undefined') {
      return stripTicketFromUrl(window.location.href);
    }
    throw new QoAuthError(
      'Service URL must be provided or configured in non-browser environments.',
      'MISSING_SERVICE_URL'
    );
  }
}
