/**
 * Builds the QHub CAS SSO login URL.
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
 * Extracts the CAS `ticket` query parameter from the given URL or current window.location.
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
 * Removes the `ticket` query parameter from a URL string while preserving other parameters.
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
 * Normalizes service URL for comparison and CAS validation.
 */
export function normalizeServiceUrl(serviceUrl: string): string {
  return stripTicketFromUrl(serviceUrl);
}
