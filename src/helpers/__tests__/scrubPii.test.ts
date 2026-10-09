import { scrubText, scrubValue } from '@/helpers/scrubPii';
import { describe, expect, it } from 'vitest';

describe('scrubText', () => {
  it.each([
    ['an email address', 'contact jane.doe+lab@example.co.uk now', 'contact [email] now'],
    [
      'an email inside a URL path',
      'GET https://x.com/u/jane@example.com/p',
      'GET https://x.com/u/[email]/p',
    ],
    [
      'a URL query string',
      'fetch https://shop.example.com/p/1?q=aspirin&t=1 failed',
      'fetch https://shop.example.com/p/1 failed',
    ],
    [
      'a URL fragment',
      'at https://shop.example.com/p/1#reviews',
      'at https://shop.example.com/p/1',
    ],
    ['URL credentials', 'https://user:pw@shop.example.com/p', 'https://shop.example.com/p'],
    ['an IPv4 address', 'peer 203.0.113.42 refused', 'peer [ip] refused'],
    ['an IPv6 address', 'peer 2001:db8:85a3:0:0:8a2e:370:7334 refused', 'peer [ip] refused'],
    ['a macOS home path', 'at /Users/jane/dev/app.js:1', 'at /Users/[user]/dev/app.js:1'],
    ['a Linux home path', 'at /home/jane/app.js', 'at /home/[user]/app.js'],
    ['a Windows home path', 'at C:\\Users\\Jane\\app.js', 'at C:\\Users\\[user]\\app.js'],
    ['a bearer token', 'Authorization: Bearer abcdef1234567890', 'Authorization: [redacted]'],
    ['a JWT', 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.SflKxwRJSMeKKF2QT4f', 'jwt [token]'],
    ['a key=value secret', 'retry api_key=sk_live_12345 ok', 'retry api_key=[redacted] ok'],
    ['a quoted password pair', `login {"password": "hunter2"}`, `login {"password": [redacted]}`],
    [
      'an OAuth form body',
      'client_id=VVjdGUHAb3E1&client_secret=s3cr3t&grant_type=client_credentials',
      'client_id=[redacted]&client_secret=[redacted]&grant_type=client_credentials',
    ],
    [
      'compound and camelCase JSON credentials',
      '{"client_id":"abc123","clientSecret":"zzz","refresh_token":"r"}',
      '{"client_id":[redacted],"clientSecret":[redacted],"refresh_token":[redacted]}',
    ],
    ['an x-api-key header string', 'x-api-key: 9f8e7d6c5b4a', 'x-api-key: [redacted]'],
  ])('removes %s', (_label, input, expected) => {
    expect(scrubText(input)).toBe(expected);
  });

  it.each([
    ['one long word', 'a'.repeat(200_000)],
    ['a long dotted run', 'a.'.repeat(100_000)],
    ['a long run of dashes and digits', '1-'.repeat(100_000)],
    ['many near-miss credentials', 'token '.repeat(40_000)],
  ])('stays fast and bounded on %s', (_label, input) => {
    const started = performance.now();
    const scrubbed = scrubText(`${input} jane@example.com`);

    expect(scrubbed.length).toBeLessThanOrEqual(50_000);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it.each([
    ['a plain message', 'Request failed with status 503'],
    ['a CAS number', 'CAS 7732-18-5 not found'],
    ['a clock time', 'timed out at 12:30:45.123'],
    ['a version number', 'ChemPal 1.16.0 on Chrome'],
    ['an extension URL', 'at chrome-extension://abcdefgh/assets/main.js:1:2'],
  ])('leaves %s untouched', (_label, input) => {
    expect(scrubText(input)).toBe(input);
  });
});

describe('scrubValue', () => {
  it('redacts sensitive keys at any depth, whatever their case or separator', () => {
    const scrubbed = scrubValue({
      title: 'Aspirin',
      headers: { Authorization: 'Bearer abcdefgh12345', 'X-Api-Key': 'k', 'content-type': 'json' },
      user: { email: 'a@b.co', first_name: 'Jo', id: 7 },
      settings: { location: 'US', currency: 'USD', access_token: 't', client_id: 'c' },
    });

    expect(scrubbed).toEqual({
      title: 'Aspirin',
      headers: { Authorization: '[redacted]', 'X-Api-Key': '[redacted]', 'content-type': 'json' },
      user: { email: '[redacted]', first_name: '[redacted]', id: 7 },
      settings: {
        location: '[redacted]',
        currency: 'USD',
        access_token: '[redacted]',
        client_id: '[redacted]',
      },
    });
  });

  it('scrubs strings nested in arrays and objects', () => {
    expect(scrubValue({ urls: ['https://x.com/a?q=secret'], note: 'ping a@b.co' })).toEqual({
      urls: ['https://x.com/a'],
      note: 'ping [email]',
    });
  });

  it('reduces an Error to its name and scrubbed message', () => {
    const scrubbed = scrubValue(new TypeError('bad for jane@example.com'));

    expect(scrubbed).toEqual({ name: 'TypeError', message: 'bad for [email]' });
  });

  it('cuts cycles but keeps repeated, non-circular references', () => {
    const shared = { n: 1 };
    const circular: Record<string, unknown> = { a: shared, b: shared };
    circular.self = circular;

    expect(scrubValue(circular)).toEqual({ a: { n: 1 }, b: { n: 1 }, self: '[circular]' });
  });

  it('bounds depth and list length', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    const long = Array.from({ length: 25 }, (_, i) => i);

    expect(scrubValue(deep)).toEqual({ a: { b: { c: { d: '[object]' } } } });
    expect(scrubValue(long)).toEqual([...long.slice(0, 20), '[5 more]']);
  });

  it.each([
    ['a number', 5, 5],
    ['a boolean', false, false],
    ['null', null, null],
    ['undefined', undefined, undefined],
    ['a bigint', 10n, '10'],
    ['a function', () => 1, '[function]'],
  ])('passes through %s', (_label, input, expected) => {
    expect(scrubValue(input)).toBe(expected);
  });
});
