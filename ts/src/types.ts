/** Configuration for a QuantumOriginal authentication client. */
export interface QoAuthConfig {
  /**
   * QAPI3 base URL. Defaults to `https://api.qoriginal.vip`.
   */
  apiBaseUrl?: string;

  /**
   * QuantumOriginal CAS login portal URL. Defaults to `https://qoriginal.vip/login`.
   */
  authPortalUrl?: string;

  /**
   * Default service callback URL associated with a login ticket.
   * If omitted in a browser, the current URL without its ticket is used.
   */
  serviceUrl?: string;

  /**
   * Custom token storage implementation.
   * Defaults to `LocalStorageTokenStorage` when `localStorage` is available, otherwise
   * `MemoryTokenStorage`.
   */
  storage?: TokenStorage;

  /**
   * Custom Fetch implementation, useful for tests or environments with a custom transport.
   */
  fetch?: typeof fetch;
}

/** Authenticated QuantumOriginal user returned after successful ticket validation. */
export interface QoAuthUser {
  /** Account name. */
  user: string;
  /** Numeric account identifier, when provided by QAPI3. */
  uid?: number;
  /** API token used for authenticated requests. */
  token: string;
  /** QuantumOriginal account category. */
  accountType: 'qo' | 'guest';
  /** Additional account attributes returned by QAPI3. */
  attributes: {
    score: number;
    frozen: boolean;
  };
}

/** Successful response returned by the service-ticket validation endpoint. */
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

/** Error response returned when service-ticket validation fails. */
export interface ServiceValidateErrorResponse {
  success: false;
  code: string;
  message: string;
}

/** Discriminated success or error response from service-ticket validation. */
export type ServiceValidateResponse =
  | ServiceValidateSuccessResponse
  | ServiceValidateErrorResponse;

/** Storage interface used for persisting the authenticated user and API token. */
export interface TokenStorage {
  /** Reads a stored value, returning `null` when the key does not exist. */
  getItem(key: string): string | null | Promise<string | null>;
  /** Stores a value for the given key. */
  setItem(key: string, value: string): void | Promise<void>;
  /** Removes the value for the given key. */
  removeItem(key: string): void | Promise<void>;
}

/** Base error raised by the authentication SDK. */
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

/** Error indicating that a service ticket is invalid, expired, or bound to another service. */
export class TicketInvalidError extends QoAuthError {
  constructor(message = 'The service ticket is invalid, expired, or mismatched.') {
    super(message, 'INVALID_TICKET', 401);
    this.name = 'TicketInvalidError';
  }
}

/** Error indicating that the QuantumOriginal account is frozen. */
export class AccountFrozenError extends QoAuthError {
  constructor(message = 'This QuantumOriginal account has been frozen.') {
    super(message, 'ACCOUNT_FROZEN', 403);
    this.name = 'AccountFrozenError';
  }
}
