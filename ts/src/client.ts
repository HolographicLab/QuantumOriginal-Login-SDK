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

export class QoAuthClient {
  public readonly apiBaseUrl: string;
  public readonly authPortalUrl: string;
  public readonly defaultServiceUrl?: string;
  public readonly storage: TokenStorage;
  private readonly customFetch: typeof fetch;

  constructor(config: QoAuthConfig = {}) {
    this.apiBaseUrl = (config.apiBaseUrl ?? 'https://api.qoriginal.vip').replace(
      /\/+$/,
      ''
    );
    this.authPortalUrl =
      config.authPortalUrl ?? 'https://app.qoriginal.vip/login';
    this.defaultServiceUrl = config.serviceUrl;
    this.storage = config.storage ?? createDefaultStorage();
    this.customFetch = config.fetch ?? fetch.bind(globalThis);
  }

  /**
   * Generates the redirect URL to the central QHub login page with the `service` callback parameter.
   */
  public getLoginUrl(
    serviceUrl?: string,
    extraParams?: Record<string, string>
  ): string {
    const targetService = this.resolveServiceUrl(serviceUrl);
    return buildLoginUrl(this.authPortalUrl, targetService, extraParams);
  }

  /**
   * Redirects the current browser window to the central login page.
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
   * Validates a CAS Service Ticket (`ST-xxxx`) with QAPI3 and returns user identity and API token.
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
   * validates it, strips ticket from the browser address bar, and returns the authenticated user.
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

  public async getToken(): Promise<string | null> {
    return await this.storage.getItem('token');
  }

  public async setToken(token: string | null): Promise<void> {
    if (token) {
      await this.storage.setItem('token', token);
    } else {
      await this.storage.removeItem('token');
    }
  }

  public async getUser(): Promise<QoAuthUser | null> {
    const raw = await this.storage.getItem('user');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as QoAuthUser;
    } catch {
      return null;
    }
  }

  public async setUser(user: QoAuthUser | null): Promise<void> {
    if (user) {
      await this.storage.setItem('user', JSON.stringify(user));
    } else {
      await this.storage.removeItem('user');
    }
  }

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
