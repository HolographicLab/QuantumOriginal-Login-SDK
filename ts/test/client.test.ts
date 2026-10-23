import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QoAuthClient,
  buildLoginUrl,
  extractTicketFromUrl,
  stripTicketFromUrl,
  MemoryTokenStorage,
  TicketInvalidError,
  AccountFrozenError,
  QoAuthError,
} from '../src/index.js';

describe('TypeScript SDK URL Utilities', () => {
  it('buildLoginUrl sets service and extra parameters', () => {
    const url = buildLoginUrl('https://qoriginal.vip/login', 'https://ai.qoriginal.vip/callback', {
      theme: 'dark',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://qoriginal.vip');
    assert.equal(parsed.pathname, '/login');
    assert.equal(parsed.searchParams.get('service'), 'https://ai.qoriginal.vip/callback');
    assert.equal(parsed.searchParams.get('theme'), 'dark');
  });

  it('defaults to the QuantumOriginal login portal', () => {
    const client = new QoAuthClient({
      serviceUrl: 'https://ai.qoriginal.vip/callback',
    });
    const parsed = new URL(client.getLoginUrl());

    assert.equal(parsed.origin, 'https://qoriginal.vip');
    assert.equal(parsed.pathname, '/login');
  });

  it('extractTicketFromUrl correctly extracts ticket', () => {
    const testUrl = 'https://ai.qoriginal.vip/callback?foo=bar&ticket=ST-123456#hash';
    assert.equal(extractTicketFromUrl(testUrl), 'ST-123456');
    assert.equal(extractTicketFromUrl('https://ai.qoriginal.vip/callback'), null);
  });

  it('stripTicketFromUrl removes ticket parameter cleanly', () => {
    const testUrl = 'https://ai.qoriginal.vip/callback?ticket=ST-123456&theme=dark';
    const stripped = stripTicketFromUrl(testUrl);
    const parsed = new URL(stripped);
    assert.equal(parsed.searchParams.has('ticket'), false);
    assert.equal(parsed.searchParams.get('theme'), 'dark');
  });
});

describe('QoAuthClient Token & Validation Flow', () => {
  it('validates ticket successfully and saves token into storage', async () => {
    const storage = new MemoryTokenStorage();
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      assert.equal(url, 'https://api.qoriginal.vip/qo/auth/serviceValidate');
      assert.equal(init?.method, 'POST');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.ticket, 'ST-valid-ticket');
      assert.equal(body.service, 'https://ai.qoriginal.vip/callback');
      assert.equal(body.clientId, 'qmod');

      return new Response(
        JSON.stringify({
          success: true,
          user: 'Glowingstone',
          uid: 1294915648,
          token: 'token-service-xyz',
          clientId: 'qmod',
          accountType: 'qo',
          attributes: { score: 10, frozen: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new QoAuthClient({
      storage,
      fetch: mockFetch,
      serviceUrl: 'https://ai.qoriginal.vip/callback',
      clientId: 'qmod',
    });

    const user = await client.validateTicket('ST-valid-ticket');
    assert.equal(user.user, 'Glowingstone');
    assert.equal(user.uid, 1294915648);
    assert.equal(user.token, 'token-service-xyz');
    assert.equal(user.clientId, 'qmod');
    assert.equal(user.accountType, 'qo');
    assert.equal(user.attributes.score, 10);

    const savedToken = await client.getToken();
    assert.equal(savedToken, 'token-service-xyz');

    const savedUser = await client.getUser();
    assert.equal(savedUser?.user, 'Glowingstone');
  });

  it('throws TicketInvalidError on invalid or expired ticket', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'INVALID_TICKET',
          message: 'Invalid or expired ticket',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new QoAuthClient({
      storage: new MemoryTokenStorage(),
      fetch: mockFetch,
      serviceUrl: 'https://ai.qoriginal.vip/callback',
    });

    await assert.rejects(
      async () => {
        await client.validateTicket('ST-bad-ticket');
      },
      (err: unknown) => {
        assert.ok(err instanceof TicketInvalidError);
        assert.equal((err as TicketInvalidError).code, 'INVALID_TICKET');
        return true;
      }
    );
  });

  it('throws AccountFrozenError on frozen account', async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          success: false,
          code: 'ACCOUNT_FROZEN',
          message: 'Account is frozen',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new QoAuthClient({
      storage: new MemoryTokenStorage(),
      fetch: mockFetch,
      serviceUrl: 'https://ai.qoriginal.vip/callback',
    });

    await assert.rejects(
      async () => {
        await client.validateTicket('ST-frozen-ticket');
      },
      (err: unknown) => {
        assert.ok(err instanceof AccountFrozenError);
        assert.equal((err as AccountFrozenError).code, 'ACCOUNT_FROZEN');
        return true;
      }
    );
  });

  it('refreshes a saved session and preserves the server client identifier', async () => {
    const storage = new MemoryTokenStorage();
    await storage.setItem('token', 'old-token');
    const mockFetch: typeof fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.qoriginal.vip/qo/auth/session/refresh');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('Authorization'), 'old-token');
      return new Response(
        JSON.stringify({
          success: true,
          user: 'Glowingstone',
          uid: 1294915648,
          token: 'refreshed-token',
          clientId: 'qcommunity',
          accountType: 'qo',
          attributes: { score: 10, frozen: false },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };
    const client = new QoAuthClient({ storage, fetch: mockFetch });

    const user = await client.refreshSession();

    assert.equal(user.token, 'refreshed-token');
    assert.equal(user.clientId, 'qcommunity');
    assert.equal(await client.getToken(), 'refreshed-token');
  });

  it('authenticatedFetch attaches Authorization header', async () => {
    const storage = new MemoryTokenStorage();
    storage.setItem('token', 'my-auth-token');

    let receivedAuthHeader: string | null = null;
    const mockFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      receivedAuthHeader = headers.get('Authorization');
      return new Response(JSON.stringify({ ok: true }));
    };

    const client = new QoAuthClient({
      storage,
      fetch: mockFetch,
    });

    await client.authenticatedFetch('https://api.qoriginal.vip/qo/authorization/account');
    assert.equal(receivedAuthHeader, 'Bearer my-auth-token');
  });

  it('keeps stored credentials when refresh fails temporarily or returns incomplete data', async () => {
    for (const [status, responseBody, expectedCode] of [
      [503, { success: false }, 'REFRESH_FAILED'],
      [200, { success: true, user: 'Glowingstone', attributes: { score: 10, frozen: false } }, 'INVALID_RESPONSE'],
      [200, { success: true, user: '', token: 'new-token', attributes: { score: 10, frozen: false } }, 'INVALID_RESPONSE'],
    ] as const) {
      const storage = new MemoryTokenStorage();
      storage.setItem('token', 'old-token');
      storage.setItem('user', 'saved-user');
      const client = new QoAuthClient({
        storage,
        fetch: async () => new Response(JSON.stringify(responseBody), { status }),
      });
      await assert.rejects(client.refreshSession(), (error: unknown) => {
        assert.ok(error instanceof QoAuthError);
        assert.equal(error.code, expectedCode);
        return true;
      });
      assert.equal(await client.getToken(), 'old-token');
      assert.equal(storage.getItem('user'), 'saved-user');
    }
  });

  it('reports rejected and frozen sessions with actionable codes', async () => {
    for (const [status, code] of [[401, 'INVALID_TOKEN'], [403, 'ACCOUNT_FROZEN']] as const) {
      const storage = new MemoryTokenStorage();
      storage.setItem('token', 'old-token');
      const client = new QoAuthClient({
        storage,
        fetch: async () => new Response(JSON.stringify({ success: false, code }), { status }),
      });
      await assert.rejects(client.refreshSession(), (error: unknown) => {
        assert.ok(error instanceof QoAuthError);
        assert.equal(error.code, code);
        return true;
      });
    }
  });

  it('rejects missing sessions before sending a refresh request', async () => {
    const client = new QoAuthClient({
      storage: new MemoryTokenStorage(),
      fetch: async () => { throw new Error('Unexpected request'); },
    });
    await assert.rejects(client.refreshSession(), (error: unknown) => {
      assert.ok(error instanceof QoAuthError);
      assert.equal(error.code, 'INVALID_TOKEN');
      return true;
    });
  });
});
