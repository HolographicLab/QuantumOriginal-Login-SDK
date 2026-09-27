/**
 * Builds a QuantumOriginal CAS login URL.
 *
 * @param authPortalUrl Login portal URL, such as `https://qoriginal.vip/login`.
 * @param serviceUrl Service callback URL to bind to the login ticket.
 * @param extraParams Additional login portal query parameters.
 * @returns The login portal URL with the service and extra parameters.
 */
export function buildLoginUrl(
  authPortalUrl: string,
  serviceUrl: string,
  extraParams?: Record<string, string>
): string {
  const url = new URL(authPortalUrl);
  url.searchParams.set('service', serviceUrl);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

/**
 * Extracts the CAS `ticket` query parameter from a URL.
 *
 * @param targetUrl URL to inspect. Defaults to the current browser URL.
 * @returns The ticket value, or `null` when absent or when no valid URL is available.
 */
export function extractTicketFromUrl(targetUrl?: string): string | null {
  const urlString =
    targetUrl ?? (typeof window !== 'undefined' ? window.location.href : null);
  if (!urlString) return null;

  try {
    const parsed = new URL(urlString);
    return parsed.searchParams.get('ticket');
  } catch {
    return null;
  }
}

/**
 * Removes the `ticket` query parameter while preserving other URL components and parameters.
 *
 * @param targetUrl URL to clean. Defaults to the current browser URL.
 * @returns The URL without its ticket, or the original input when it cannot be parsed.
 */
export function stripTicketFromUrl(targetUrl?: string): string {
  const urlString =
    targetUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
  if (!urlString) return '';

  try {
    const parsed = new URL(urlString);
    parsed.searchParams.delete('ticket');
    return parsed.toString();
  } catch {
    return urlString;
  }
}

/**
 * Removes a CAS ticket from a service URL before validation.
 *
 * @param serviceUrl Service callback URL, optionally containing a ticket.
 * @returns The service URL without the `ticket` query parameter.
 */
export function normalizeServiceUrl(serviceUrl: string): string {
  return stripTicketFromUrl(serviceUrl);
}
