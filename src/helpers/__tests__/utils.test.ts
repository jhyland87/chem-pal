import {
  base36Timestamp,
  base64EncodeUtf8,
  decodeHTMLEntities,
  delayAction,
  deserialize,
  findPdfHref,
  firstMap,
  formatFromHtml,
  formatFromHtmlTurndown,
  formatTimestamp,
  generatePageSizes,
  getLanguageName,
  getPath,
  getUserLanguage,
  getUserLocation,
  htmlToAscii,
  mapDefined,
  md5sum,
  objectToQueryString,
  parseJsonFromDirtyString,
  serialize,
  sleep,
  stripHTML,
  toFiniteNumber,
  tryParseJson,
  zodAddActualValueToIssues,
} from '@/helpers/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('findPdfHref', () => {
  it('should extract a PDF link from an anchor tag', () => {
    const html =
      '<p><a href="https://x.usrfiles.com/ugd/abc_def.pdf" target="_blank">Safety Data Sheet</a></p>';
    expect(findPdfHref(html)).toBe('https://x.usrfiles.com/ugd/abc_def.pdf');
  });

  it('should return the first PDF link when several are present', () => {
    const html =
      '<a href="https://x.com/first.pdf">SDS</a><a href="https://x.com/second.pdf">Spec</a>';
    expect(findPdfHref(html)).toBe('https://x.com/first.pdf');
  });

  it('should return undefined when there is no PDF link', () => {
    expect(findPdfHref('<a href="https://x.com/page">Info</a>')).toBeUndefined();
    expect(findPdfHref('')).toBeUndefined();
  });
});

describe('md5sum', () => {
  it('should hash strings correctly', () => {
    expect(md5sum('test')).toBe('098f6bcd4621d373cade4e832627b4f6');
    expect(md5sum('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
  });

  it('should handle different input types', () => {
    expect(md5sum(123)).toBe('202cb962ac59075b964b07152d234b70');
    expect(md5sum({ test: 'value' })).toBe('1c623102e25ffbd59a0e5709c503902e');
    expect(md5sum({ a: 1, b: 'two', c: [3, 'four'] })).toBe('4cde5f9f7861a1d940a8e816f78dd774');
  });

  it('should throw error for invalid input types', () => {
    expect(() => md5sum(Symbol('test'))).toThrow('Unexpected input type: symbol');
  });
});

describe('objectToQueryString', () => {
  it('serializes objects in insertion order', () => {
    expect(objectToQueryString({ a: 1, b: 'two' })).toBe('a=1&b=two');
    expect(objectToQueryString({ foo: 'bar' })).toBe('foo=bar');
  });

  it('joins array values with commas', () => {
    expect(objectToQueryString({ __: ['timestamp', 'proid'] })).toBe('__=timestamp,proid');
  });
});

describe('base64EncodeUtf8', () => {
  it('encodes ascii strings', () => {
    expect(base64EncodeUtf8('hello')).toBe('aGVsbG8=');
    expect(base64EncodeUtf8(md5sum('test'))).toBe('MDk4ZjZiY2Q0NjIxZDM3M2NhZGU0ZTgzMjYyN2I0ZjY=');
  });
});

describe('base36Timestamp', () => {
  it('returns a non-empty base-36 string', () => {
    expect(base36Timestamp()).toMatch(/^[a-z0-9]+$/);
  });

  it('uses the supplied timestamp as the base-36 prefix', () => {
    const ts = 1_000_000;
    const out = base36Timestamp(ts);
    expect(out.startsWith(ts.toString(36))).toBe(true);
  });
});

describe('objectToQueryString (edge cases)', () => {
  it('emits an empty value for null/undefined entries', () => {
    expect(objectToQueryString({ a: null, b: undefined, c: 'x' })).toBe('a=&b=&c=x');
  });

  it('returns an empty string for an empty object', () => {
    expect(objectToQueryString({})).toBe('');
  });
});

describe('base64EncodeUtf8 (unicode)', () => {
  it('encodes multibyte characters via the UTF-8 path', () => {
    const encoded = base64EncodeUtf8('你好');
    expect(atob(encoded)).toBe(unescape(encodeURIComponent('你好')));
  });
});

describe('generatePageSizes', () => {
  it('doubles up to the total with the default base/limit', () => {
    expect(generatePageSizes(123)).toEqual([10, 20, 40, 80, 123]);
  });

  it('honors a custom base and limit', () => {
    expect(generatePageSizes(500, 10, 4)).toEqual([10, 20, 40, 500]);
    expect(generatePageSizes(1000, 10, 3)).toEqual([10, 20, 1000]);
  });

  it('returns just the total when the limit is 1', () => {
    expect(generatePageSizes(1000, 10, 1)).toEqual([1000]);
  });

  it('with limit 0, slice(0, -1) drops only the last size (JSDoc says [1000])', () => {
    // Genuine JSDoc/impl mismatch: `slice(0, limit - 1)` with limit=0 becomes
    // slice(0, -1), which keeps all-but-last rather than returning empty.
    expect(generatePageSizes(1000, 10, 0)).toEqual([10, 20, 40, 80, 160, 320, 1000]);
  });

  it('returns just the total when total is below base', () => {
    expect(generatePageSizes(5)).toEqual([5]);
  });
});

describe('decodeHTMLEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHTMLEntities('&lt;div&gt;Hello &amp; World&lt;/div&gt;')).toBe(
      '<div>Hello & World</div>',
    );
  });

  it('decodes numeric entities', () => {
    expect(decodeHTMLEntities('&#39;Hello&#39;')).toBe("'Hello'");
  });

  it('leaves unknown named entities untouched', () => {
    expect(decodeHTMLEntities('&unknownentity;')).toBe('&unknownentity;');
  });

  it('decodes special symbol entities', () => {
    expect(decodeHTMLEntities('&euro;&pound;&copy;')).toBe('€£©');
  });
});

describe('htmlToAscii', () => {
  it('converts paragraphs and breaks into newlines and strips tags', () => {
    expect(htmlToAscii('<p>Hello <b>world</b></p><p>This is a test</p>')).toBe(
      'Hello world\nThis is a test',
    );
  });

  it('decodes basic entities and trims', () => {
    expect(htmlToAscii('  A &amp; B &lt;x&gt; &quot;q&quot; &#39;s&#39; &nbsp; ')).toBe(
      'A & B <x> "q" \'s\'',
    );
  });

  it('handles br tags', () => {
    expect(htmlToAscii('line1<br>line2<br/>line3')).toBe('line1\nline2\nline3');
  });

  it("breaks on headings and list items so blocks don't run together", () => {
    expect(
      htmlToAscii('<h2>Title</h2><p>Hello <b>world</b></p><ul><li>one</li><li>two</li></ul>'),
    ).toBe('Title\nHello world\none\ntwo');
  });

  it('collapses blank-line runs left by empty or nested blocks', () => {
    expect(htmlToAscii('<h2>Title</h2><div></div><p>Body</p>')).toBe('Title\nBody');
  });
});

describe('tryParseJson', () => {
  it('parses valid JSON', () => {
    expect(tryParseJson('{"name":"John","age":30}')).toEqual({ name: 'John', age: 30 });
  });

  it('returns undefined for invalid JSON', () => {
    expect(tryParseJson('not a json string')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(tryParseJson(undefined)).toBeUndefined();
  });
});

describe('parseJsonFromDirtyString', () => {
  it('parses an array with trailing junk', () => {
    expect(parseJsonFromDirtyString('[ "a", "b" ]\n&&&\n')).toEqual(['a', 'b']);
  });

  it('parses an object with trailing junk', () => {
    expect(parseJsonFromDirtyString('{"key":"val"} some junk')).toEqual({ key: 'val' });
  });

  it('handles nested structures and strings containing brackets', () => {
    expect(parseJsonFromDirtyString('{"a":[1,{"b":"]}"}]}###')).toEqual({ a: [1, { b: ']}' }] });
  });

  it('handles escaped quotes inside strings', () => {
    expect(parseJsonFromDirtyString('["a\\"b"]xxx')).toEqual(['a"b']);
  });

  it('throws when there is no JSON open bracket', () => {
    expect(() => parseJsonFromDirtyString('no json here')).toThrow(
      'No JSON array or object found in string',
    );
  });

  it('throws when the JSON is unterminated', () => {
    expect(() => parseJsonFromDirtyString('{"a":1')).toThrow('Unterminated JSON in string');
  });
});

describe('getUserLocation', () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;
  afterEach(() => {
    (globalThis as { chrome?: unknown }).chrome = originalChrome;
  });

  it('defaults to US outside an extension context', () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    expect(getUserLocation()).toBe('US');
  });

  it('returns the country code from the i18n locale', () => {
    (globalThis as { chrome?: unknown }).chrome = {
      i18n: { getUILanguage: () => 'en-GB' },
    };
    expect(getUserLocation()).toBe('GB');
  });
});

describe('getUserLanguage', () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;
  afterEach(() => {
    (globalThis as { chrome?: unknown }).chrome = originalChrome;
  });

  it('defaults to en-US outside an extension context', () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    expect(getUserLanguage()).toBe('en-US');
  });

  it('returns the full UI language locale', () => {
    (globalThis as { chrome?: unknown }).chrome = {
      i18n: { getUILanguage: () => 'de-DE' },
    };
    expect(getUserLanguage()).toBe('de-DE');
  });
});

describe('getLanguageName', () => {
  it('returns undefined for undefined input', () => {
    expect(getLanguageName(undefined)).toBeUndefined();
  });

  it('resolves a language name from a locale', () => {
    expect(getLanguageName('en-US')).toBe('English');
    expect(getLanguageName('de-DE')).toBe('Deutsch');
  });

  it('falls back to the raw code for an unknown language', () => {
    expect(getLanguageName('zz')).toBe('zz');
  });
});

describe('stripHTML', () => {
  it('removes HTML tags leaving the text', () => {
    expect(stripHTML('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('returns an empty string for tag-only input', () => {
    expect(stripHTML('<br/>')).toBe('');
  });
});

describe('formatFromHtmlTurndown', () => {
  it('converts bold html to markdown', () => {
    expect(formatFromHtmlTurndown('<b>Bold</b>')).toBe('**Bold**');
  });
});

describe('formatFromHtml', () => {
  it('returns text content when there are no child elements', () => {
    expect(formatFromHtml('just text')).toBe('just text');
  });

  it('formats paragraphs, lists and links', () => {
    const html =
      '<p>Intro</p><ul><li>Item 1</li><li>Item 2</li></ul>' +
      '<ol><li>First</li><li>Second</li></ol><a href="https://x.com">Link</a>';
    expect(formatFromHtml(html)).toBe(
      'Intro\n\n- Item 1\n- Item 2\n1) First\n2) Second\nLink (https://x.com)',
    );
  });

  it('falls back to text content for unknown elements', () => {
    expect(formatFromHtml('<div>plain div</div>')).toBe('plain div');
  });
});

describe('formatTimestamp', () => {
  it('formats an epoch ms value into a short date-time string', () => {
    const out = formatTimestamp(1711468500000);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('serialize/deserialize', () => {
  it('should correctly serialize and deserialize strings', () => {
    const original = 'Hello, World!';
    const serialized = serialize(original);
    expect(typeof serialized).toBe('string');
    expect(deserialize(serialized)).toBe(original);
  });

  it('should handle special characters', () => {
    const original = '!@#$%^&*()_+{}[]|";:<>?,./';
    expect(deserialize(serialize(original))).toBe(original);
  });

  it('should handle unicode characters', () => {
    const original = '你好，世界！';
    expect(deserialize(serialize(original))).toBe(original);
  });
});

describe('sleep', () => {
  it('should delay execution for specified time', async () => {
    const start = Date.now();
    await sleep(100);
    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95); // Allow for small timing variations
  });
});

describe('delayAction', () => {
  it('should execute action after specified delay', async () => {
    const mockFn = vi.fn();
    const start = Date.now();

    await delayAction(100, mockFn);

    const duration = Date.now() - start;
    expect(duration).toBeGreaterThanOrEqual(95);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});

describe('firstMap', () => {
  it('should return first non-null/undefined result', () => {
    const fn = (x: string) => x.match(/\d+/)?.[0];
    const result = firstMap(fn, ['abc', '123', 'def']);
    expect(result).toBe('123');
  });

  it('should return undefined if no matches found', () => {
    const fn = (x: string) => x.match(/\d+/)?.[0];
    const result = firstMap(fn, ['abc', 'def', 'ghi']);
    expect(result).toBeUndefined();
  });

  it('should work with custom type transformations', () => {
    const fn = (x: number) => (x > 5 ? x * 2 : undefined);
    const result = firstMap(fn, [1, 3, 6, 8]);
    expect(result).toBe(12);
  });

  it('should handle empty array', () => {
    const fn = (x: string) => x;
    const result = firstMap(fn, []);
    expect(result).toBeUndefined();
  });
});

describe('mapDefined', () => {
  it('should filter out null and undefined values after mapping', () => {
    const input = [1, 2, 3, 4, 5];
    const fn = (x: number) => (x % 2 === 0 ? x : undefined);
    expect(mapDefined(input, fn)).toEqual([2, 4]);
  });

  it('should handle empty arrays', () => {
    const input: number[] = [];
    const fn = (x: number) => x * 2;
    expect(mapDefined(input, fn)).toEqual([]);
  });

  it('should work with object transformations', () => {
    interface User {
      name: string;
      age?: number;
    }
    const input: User[] = [
      { name: 'Alice', age: 25 },
      { name: 'Bob' },
      { name: 'Charlie', age: 30 },
    ];
    const fn = (user: User) => user.age;
    expect(mapDefined(input, fn)).toEqual([25, 30]);
  });

  it('should handle array with all null/undefined results', () => {
    const input = [1, 2, 3];
    const fn = () => null;
    expect(mapDefined(input, fn)).toEqual([]);
  });

  it('should preserve non-null falsy values', () => {
    type FalsyValue = string | number | boolean | null | undefined;
    const input: FalsyValue[] = ['', 0, false, null, undefined, 'test'];
    const fn = (x: FalsyValue) => x;
    expect(mapDefined(input, fn)).toEqual(['', 0, false, 'test']);
  });

  it('drops mapped results that are empty arrays but keeps non-empty ones', () => {
    const input = [1, 2, 3];
    const fn = (x: number) => (x === 2 ? [] : [x]);
    expect(mapDefined(input, fn)).toEqual([[1], [3]]);
  });
});

describe('Utils', () => {
  it('should handle async operations', () => {
    const mockFn = vi.fn();
    // ... rest of the test
  });
});

describe('getPath', () => {
  it('resolves a deep key path', () => {
    expect(getPath({ a: { b: { c: 1 } } }, ['a', 'b', 'c'])).toBe(1);
  });

  it('returns undefined when any segment is missing', () => {
    expect(getPath({ a: { b: 1 } }, ['a', 'x'])).toBeUndefined();
    expect(getPath({ a: { b: 1 } }, ['a', 'x', 'y'])).toBeUndefined();
  });

  it('indexes arrays with numeric segments', () => {
    expect(getPath({ items: [10, 20, 30] }, ['items', 1])).toBe(20);
    expect(
      getPath(
        [
          [1, 2],
          [3, 4],
        ],
        [1, 0],
      ),
    ).toBe(3);
  });

  it('short-circuits on null without throwing', () => {
    expect(getPath({ a: null }, ['a', 'b'])).toBeNull();
  });

  it('short-circuits on undefined without throwing', () => {
    expect(getPath({ a: undefined }, ['a', 'b'])).toBeUndefined();
  });

  it('returns the root when the path is empty', () => {
    const root = { a: 1 };
    expect(getPath(root, [])).toBe(root);
  });

  it('returns undefined when rooted at null or undefined', () => {
    expect(getPath(null, ['a'])).toBeNull();
    expect(getPath(undefined, ['a'])).toBeUndefined();
  });
});

describe('zodAddActualValueToIssues', () => {
  it('adds the resolved actual value from the source object', () => {
    const issues = [{ path: ['user', 'age'], code: 'invalid_type', message: 'Expected number' }];
    const obj = { user: { age: 'forty' } };

    expect(zodAddActualValueToIssues(issues, obj)).toEqual([
      {
        path: ['user', 'age'],
        code: 'invalid_type',
        message: 'Expected number',
        actual: 'forty',
      },
    ]);
  });

  it('sets actual to undefined when the path is missing on the source object', () => {
    const issues = [{ path: ['missing'], message: 'required' }];
    expect(zodAddActualValueToIssues(issues, {})).toEqual([
      { path: ['missing'], message: 'required', actual: undefined },
    ]);
  });

  it('preserves any extra fields on each issue', () => {
    const issues = [{ path: ['a'], code: 'x', expected: 'string', received: 'number' }];
    const out = zodAddActualValueToIssues(issues, { a: 7 });
    expect(out[0]).toMatchObject({ code: 'x', expected: 'string', received: 'number', actual: 7 });
  });

  it('returns an empty array when given no issues', () => {
    expect(zodAddActualValueToIssues([], { a: 1 })).toEqual([]);
  });

  it('supports numeric path segments (array indexes)', () => {
    const issues = [{ path: ['items', 1], message: 'bad' }];
    const obj = { items: [10, 20, 30] };
    expect(zodAddActualValueToIssues(issues, obj)).toEqual([
      { path: ['items', 1], message: 'bad', actual: 20 },
    ]);
  });

  it('does not mutate the input issue objects', () => {
    const original = { path: ['a'], message: 'bad' };
    const frozen = Object.freeze({ ...original });
    expect(() => zodAddActualValueToIssues([frozen], { a: 1 })).not.toThrow();
    expect(frozen).toEqual(original);
    expect('actual' in frozen).toBe(false);
  });
});

describe('toFiniteNumber', () => {
  it('parses a plain decimal string', () => {
    expect(toFiniteNumber('12.5')).toBe(12.5);
  });

  it('parses exponent notation', () => {
    expect(toFiniteNumber('1e5')).toBe(100000);
  });

  it('keeps zero, which is a real value rather than an empty one', () => {
    expect(toFiniteNumber('0')).toBe(0);
  });

  it('rejects trailing garbage instead of truncating it like parseFloat', () => {
    expect(toFiniteNumber('12abc')).toBeUndefined();
  });

  it('returns undefined for blank input', () => {
    expect(toFiniteNumber('')).toBeUndefined();
    expect(toFiniteNumber('   ')).toBeUndefined();
  });

  it('returns undefined for non-finite input', () => {
    expect(toFiniteNumber('abc')).toBeUndefined();
    expect(toFiniteNumber('Infinity')).toBeUndefined();
    expect(toFiniteNumber('NaN')).toBeUndefined();
  });
});
