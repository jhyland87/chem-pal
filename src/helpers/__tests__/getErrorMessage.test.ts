import { EmptyResponseError, getErrorMessage, HttpError } from '@/helpers/exceptions';
import { describe, expect, it } from 'vitest';

describe('getErrorMessage', () => {
  it.each([
    ['an Error', new TypeError('bad input'), 'bad input'],
    ['a subclass of Error', new EmptyResponseError('Response is empty'), 'Response is empty'],
    ['an HttpError', new HttpError(403, 'Forbidden'), 'HTTP Error: 403 Forbidden'],
    ['an Error with an empty message', new RangeError(''), 'RangeError'],
    ['a string', 'user_aborted', 'user_aborted'],
    ['an empty string', '', ''],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null'],
    ['a number', 404, '404'],
    ['a plain object', { code: 1 }, '[object Object]'],
    ['a null-prototype object, which has no toString', Object.create(null), 'Unknown error'],
  ])('reads %s', (_label, thrown, expected) => {
    expect(getErrorMessage(thrown)).toBe(expected);
  });
});
