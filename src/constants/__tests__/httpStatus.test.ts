import { HttpStatus } from '@/constants/httpStatus';
import { describe, expect, it } from 'vitest';

// The numbers are the contract: a mistyped value would silently misroute retry/auth logic,
// so every member is pinned to its RFC 9110 / 6585 / 7538 / 7725 code.
const EXPECTED: ReadonlyArray<[keyof typeof HttpStatus, number]> = [
  ['OK', 200],
  ['CREATED', 201],
  ['ACCEPTED', 202],
  ['NO_CONTENT', 204],
  ['PARTIAL_CONTENT', 206],
  ['MOVED_PERMANENTLY', 301],
  ['FOUND', 302],
  ['SEE_OTHER', 303],
  ['NOT_MODIFIED', 304],
  ['TEMPORARY_REDIRECT', 307],
  ['PERMANENT_REDIRECT', 308],
  ['BAD_REQUEST', 400],
  ['UNAUTHORIZED', 401],
  ['PAYMENT_REQUIRED', 402],
  ['FORBIDDEN', 403],
  ['NOT_FOUND', 404],
  ['METHOD_NOT_ALLOWED', 405],
  ['NOT_ACCEPTABLE', 406],
  ['REQUEST_TIMEOUT', 408],
  ['CONFLICT', 409],
  ['GONE', 410],
  ['PAYLOAD_TOO_LARGE', 413],
  ['UNSUPPORTED_MEDIA_TYPE', 415],
  ['UNPROCESSABLE_ENTITY', 422],
  ['TOO_MANY_REQUESTS', 429],
  ['UNAVAILABLE_FOR_LEGAL_REASONS', 451],
  ['INTERNAL_SERVER_ERROR', 500],
  ['NOT_IMPLEMENTED', 501],
  ['BAD_GATEWAY', 502],
  ['SERVICE_UNAVAILABLE', 503],
  ['GATEWAY_TIMEOUT', 504],
];

describe('HttpStatus', () => {
  it.each(EXPECTED)('%s is %i', (name, code) => {
    expect(HttpStatus[name]).toBe(code);
  });

  it('has no members beyond the pinned list', () => {
    const names = Object.keys(HttpStatus).filter((key) => Number.isNaN(Number(key)));
    expect(names.sort()).toEqual(EXPECTED.map(([name]) => name).sort());
  });

  it('gives every code exactly one name', () => {
    const codes = EXPECTED.map(([, code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each([
    ['2xx', 200, 299],
    ['3xx', 300, 399],
    ['4xx', 400, 499],
    ['5xx', 500, 599],
  ])('keeps the %s members inside their class', (_label, min, max) => {
    const inClass = EXPECTED.filter(([, code]) => code >= min && code <= max);
    expect(inClass.length).toBeGreaterThan(0);
  });
});
