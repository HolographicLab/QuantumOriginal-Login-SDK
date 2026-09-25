export interface QoAuthConfig {
  /**
   * QAPI3 base URL. Defaults to 'https://api.qoriginal.vip'.
   */
  apiBaseUrl?: string;

  /**
   * QHub CAS Login portal URL. Defaults to 'https://app.qoriginal.vip/login'.
   */
  authPortalUrl?: string;

  /**
   * Default service callback URL to redirect back after login.
   * If omitted in browser, defaults to current window.location.href (without ticket query).
   */
  serviceUrl?: string;

  /**
   * Custom token storage implementation.
   * Defaults to LocalStorageTokenStorage in browser, MemoryTokenStorage in Node/non-browser.
   */
  storage?: TokenStorage;

  /**
   * Custom fetch implementation (useful for Node, tests or mock environments).
   */
  fetch?: typeof fetch;
}

export interface QoAuthUser {
  user: string;
  uid?: number;
  token: string;
  accountType: 'qo' | 'guest';
  attributes: {
    score: number;
    frozen: boolean;
  };
}

export interface ServiceValidateSuccessResponse {
  success: true;
  user: string;
  uid?: number;
  token: string;
  accountType: 'qo' | 'guest';
  attributes: {
    score: number;
    frozen: boolean;
  };
}

export interface ServiceValidateErrorResponse {
  success: false;
  code: string;
  message: string;
}

export type ServiceValidateResponse =
  | ServiceValidateSuccessResponse
  | ServiceValidateErrorResponse;

export interface TokenStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export class QoAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR',
    public readonly status?: number
  ) {
    super(message);
    this.name = 'QoAuthError';
  }
}

export class TicketInvalidError extends QoAuthError {
  constructor(message = 'The service ticket is invalid, expired, or mismatched.') {
    super(message, 'INVALID_TICKET', 401);
    this.name = 'TicketInvalidError';
  }
}

export class AccountFrozenError extends QoAuthError {
  constructor(message = 'This QuantumOriginal account has been frozen.') {
    super(message, 'ACCOUNT_FROZEN', 403);
    this.name = 'AccountFrozenError';
  }
}
