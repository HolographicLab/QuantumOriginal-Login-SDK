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

      return new Response(
        JSON.stringify({
          success: true,
          user: 'Glowingstone',
          uid: 1294915648,
          token: 'token-service-xyz',
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
    });

    const user = await client.validateTicket('ST-valid-ticket');
    assert.equal(user.user, 'Glowingstone');
    assert.equal(user.uid, 1294915648);
    assert.equal(user.token, 'token-service-xyz');
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
});
