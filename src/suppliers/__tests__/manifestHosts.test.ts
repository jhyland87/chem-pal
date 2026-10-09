// ProductBuilder must be imported before the suppliers (module-init cycle).
import '@/utils/ProductBuilder';
import manifest from '@/../public/manifest.json';
import { describe, expect, it } from 'vitest';
import * as suppliers from '..';

/**
 * Whether a Chrome match pattern (a `host_permissions` entry) covers an origin pattern that a
 * supplier requires, such as `https://shop.example.com/*`. Handles the scheme (`*`, `http`,
 * `https`), exact and `*.domain` hosts, and a `/*` path.
 * @param pattern - A `host_permissions` entry
 * @param required - A supplier's required origin pattern
 * @returns `true` when granting `pattern` also grants `required`
 */
function covers(pattern: string, required: string): boolean {
  const parse = (value: string) => /^(\*|https?):\/\/([^/]+)\/(.*)$/.exec(value);
  const granted = parse(pattern);
  const wanted = parse(required);
  if (!granted || !wanted) return false;
  const [, grantedScheme, grantedHost, grantedPath] = granted;
  const [, wantedScheme, wantedHost, wantedPath] = wanted;
  if (grantedScheme !== '*' && grantedScheme !== wantedScheme) return false;
  const hostMatches =
    grantedHost === '*' ||
    grantedHost === wantedHost ||
    (grantedHost.startsWith('*.') &&
      (wantedHost === grantedHost.slice(2) || wantedHost.endsWith(grantedHost.slice(1))));
  if (!hostMatches) return false;
  return grantedPath === '*' || grantedPath === wantedPath;
}

const HOST_PERMISSIONS: readonly string[] = manifest.host_permissions;

describe('covers (the match-pattern check used below)', () => {
  it.each([
    ['an exact host', 'https://www.ambeed.com/*', 'https://www.ambeed.com/*', true],
    ['a different host', 'https://www.ambeed.com/*', 'https://ambeed.com/*', false],
    ['a wildcard subdomain', 'https://*.typesense.net/*', 'https://abc.typesense.net/*', true],
    ['a wildcard covering its apex', 'https://*.typesense.net/*', 'https://typesense.net/*', true],
    ['a wildcard that is only a suffix', 'https://*.sense.net/*', 'https://typesense.net/*', false],
    ['http against an https-only grant', 'https://a.com/*', 'http://a.com/*', false],
    ['any scheme', '*://a.com/*', 'https://a.com/*', true],
    ['a narrower path than required', 'https://a.com/api/*', 'https://a.com/*', false],
    ['something that is not a pattern', 'a.com', 'https://a.com/*', false],
  ])('%s', (_label, pattern, required, expected) => {
    expect(covers(pattern, required)).toBe(expected);
  });
});

// A supplier whose hosts aren't in the manifest is silently skipped by SupplierFactory's permission
// check on every search (it only shows up as a `Permission check failed` warning), so every live
// supplier's required hosts must be granted by the manifest.
describe('supplier hosts are granted by the manifest', () => {
  const live = Object.entries(suppliers).flatMap(([name, supplier]) => {
    const hosts: unknown = Reflect.get(supplier, 'requiredHosts');
    return Array.isArray(hosts) ? [{ name, hosts: hosts.map(String) }] : [];
  });

  it('finds the live suppliers', () => {
    expect(live.length).toBeGreaterThan(30);
  });

  it.each(live.map(({ name, hosts }) => [name, hosts] as const))('%s', (_name, hosts) => {
    const missing = hosts.filter(
      (required) => !HOST_PERMISSIONS.some((pattern) => covers(pattern, required)),
    );

    expect(missing).toEqual([]);
  });
});
