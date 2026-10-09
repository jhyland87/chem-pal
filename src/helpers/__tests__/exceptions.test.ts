import {
  EmptyResponseError,
  HttpError,
  isAbortError,
  isExpectedAbort,
  isRateLimited,
} from '@/helpers/exceptions';
import { describe, expect, it } from 'vitest';

describe('EmptyResponseError', () => {
  it('is an Error with the given message and name', () => {
    const err = new EmptyResponseError('Response is empty');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EmptyResponseError);
    expect(err.message).toBe('Response is empty');
    expect(err.name).toBe('EmptyResponseError');
  });

  it('is catchable via instanceof', () => {
    try {
      throw new EmptyResponseError('empty');
    } catch (error) {
      expect(error instanceof EmptyResponseError).toBe(true);
    }
  });
});

describe('HttpError', () => {
  it('carries status and statusText and builds the message', () => {
    const err = new HttpError(403, 'Forbidden');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
    expect(err.statusText).toBe('Forbidden');
    expect(err.name).toBe('HttpError');
    expect(err.message).toBe('HTTP Error: 403 Forbidden');
  });

  it('lets callers branch on the numeric status', () => {
    try {
      throw new HttpError(500, 'Internal Server Error');
    } catch (error) {
      expect(error instanceof HttpError && error.status === 500).toBe(true);
    }
  });
});

describe('HttpError message', () => {
  it.each([
    ['with a status text', 403, 'Forbidden', 'HTTP Error: 403 Forbidden'],
    ['without a status text (no trailing space)', 403, '', 'HTTP Error: 403'],
  ])('reads %s', (_label, status, statusText, expected) => {
    expect(new HttpError(status, statusText).message).toBe(expected);
  });
});

describe('isAbortError', () => {
  it.each([
    ['a DOMException AbortError', new DOMException('stop', 'AbortError'), true],
    ['an Error named AbortError', Object.assign(new Error('x'), { name: 'AbortError' }), true],
    ['a plain Error', new Error('boom'), false],
    ['a TypeError', new TypeError('bad'), false],
    ['a string reason', 'user_aborted', false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, value, expected) => {
    expect(isAbortError(value)).toBe(expected);
  });
});

describe('isExpectedAbort', () => {
  it.each([
    ['an AbortError', new DOMException('stop', 'AbortError'), true],
    ['the user-stop reason string', 'user_aborted', true],
    ['the time-budget reason string', 'time_budget_exceeded', true],
    ['an Error whose message is a reason string', new Error('user_aborted'), false],
    ['an unrelated string', 'something else', false],
    ['a real failure', new TypeError('bad response'), false],
    ['null', null, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, value, expected) => {
    expect(isExpectedAbort(value)).toBe(expected);
  });
});

describe('isRateLimited', () => {
  it.each([
    ['an HttpError 429', new HttpError(429, 'Too Many Requests'), true],
    ['an HttpError 429 with no status text', new HttpError(429, ''), true],
    ['an HttpError 403', new HttpError(403, 'Forbidden'), false],
    ['an HttpError 503', new HttpError(503, 'Service Unavailable'), false],
    ['a plain Error that merely mentions 429', new Error('HTTP Error: 429'), false],
    ['the number 429', 429, false],
    ['undefined', undefined, false],
  ])('%s -> %s', (_label, value, expected) => {
    expect(isRateLimited(value)).toBe(expected);
  });
});
