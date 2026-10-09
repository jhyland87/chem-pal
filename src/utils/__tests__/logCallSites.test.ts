import { injectCallSites, isInstrumentable, logCallSitesPlugin } from '@/../tools/logCallSites.js';
import { describe, expect, it } from 'vitest';

const SRC = '/repo/src';
const FILE = `${SRC}/suppliers/Foo.ts`;

/** Runs the transform on `code` as if it were `suppliers/Foo.ts`, returning only the code. */
function run(code: string, levels?: string[], file = FILE): string | undefined {
  return injectCallSites(code, file, { srcRoot: SRC, levels })?.code;
}

describe('injectCallSites', () => {
  describe('which calls are rewritten', () => {
    it.each([
      ['this.logger', `this.logger.warn('x');`, `this.logger.warnAt("suppliers/Foo.ts:1", 'x');`],
      ['logger', `logger.error('x');`, `logger.errorAt("suppliers/Foo.ts:1", 'x');`],
      ['_logger', `_logger.warn('x');`, `_logger.warnAt("suppliers/Foo.ts:1", 'x');`],
      [
        'optional chaining',
        `this.logger?.warn('x');`,
        `this.logger?.warnAt("suppliers/Foo.ts:1", 'x');`,
      ],
    ])('rewrites a call on %s', (_label, input, expected) => {
      expect(run(input)).toBe(expected);
    });

    it('rewrites a zero-argument call without a trailing comma', () => {
      expect(run('logger.warn();')).toBe('logger.warnAt("suppliers/Foo.ts:1");');
    });

    it('reports the line of the method name for a multi-line call', () => {
      const input = [`const x = 1;`, `this.logger`, `  .warn(`, `    'x',`, `  );`].join('\n');

      expect(run(input)).toContain('.warnAt("suppliers/Foo.ts:3", ');
    });

    it('rewrites both calls when one is nested inside the other', () => {
      const out = run(`logger.error('a', logger.warn('b'));`);

      expect(out).toBe(
        `logger.errorAt("suppliers/Foo.ts:1", 'a', logger.warnAt("suppliers/Foo.ts:1", 'b'));`,
      );
    });

    it.each([
      ['info', `logger.info('x');`],
      ['debug', `logger.debug('x');`],
      ['log', `logger.log('x');`],
    ])('leaves %s calls alone by default', (_label, input) => {
      expect(run(input)).toBeUndefined();
    });

    it('instruments exactly the requested levels', () => {
      expect(run(`logger.debug('x'); logger.warn('y');`, ['debug'])).toBe(
        `logger.debugAt("suppliers/Foo.ts:1", 'x'); logger.warn('y');`,
      );
    });

    it.each([
      ['console', `console.warn('x');`],
      ['another receiver', `other.warn('x');`],
      ['a differently named logger', `myLogger.warn('x');`],
      ['a sub-logger chain', `logger.sub('a').warn('x');`],
      ['a call already rewritten', `logger.warnAt('a.ts:1', 'x');`],
      ['a generic call', `logger.warn<string>('x');`],
      ['a line comment', `// logger.warn('x');`],
      ['a block comment', `/* this.logger.error('x'); */`],
      ['a string', `const s = "logger.warn('x')";`],
      ['a template string', 'const s = `this.logger.warn(1)`;'],
    ])('does not touch %s', (_label, input) => {
      expect(run(input)).toBeUndefined();
    });
  });

  describe('the recorded function name', () => {
    it.each([
      [
        'a method',
        `class Foo {\n  bar() {\n    this.logger.warn('x');\n  }\n}`,
        'suppliers/Foo.ts:3#Foo.bar',
      ],
      [
        'a constructor',
        `class Foo {\n  constructor() {\n    this.logger.warn('x');\n  }\n}`,
        'suppliers/Foo.ts:3#Foo.constructor',
      ],
      [
        'a function declaration',
        `function helper() {\n  logger.warn('x');\n}`,
        'suppliers/Foo.ts:2#helper',
      ],
      [
        'an arrow function in a const',
        `const handler = () => {\n  logger.warn('x');\n};`,
        'suppliers/Foo.ts:2#handler',
      ],
      [
        'a class property arrow function',
        `class Foo {\n  cb = () => {\n    this.logger.warn('x');\n  };\n}`,
        'suppliers/Foo.ts:3#cb',
      ],
      [
        'an anonymous callback inside a method',
        `class Foo {\n  bar() {\n    items.forEach((i) => {\n      this.logger.warn('x');\n    });\n  }\n}`,
        'suppliers/Foo.ts:4#Foo.bar',
      ],
      ['module level', `logger.warn('x');`, 'suppliers/Foo.ts:1'],
    ])('names %s', (_label, input, location) => {
      expect(run(input)).toContain(`"${location}"`);
    });
  });

  it('handles .tsx files', () => {
    const out = run(
      `const A = () => {\n  logger.warn('x');\n  return <div />;\n};`,
      undefined,
      `${SRC}/components/A.tsx`,
    );

    expect(out).toContain('logger.warnAt("components/A.tsx:2#A", ');
  });

  it('returns a source map for the rewritten source', () => {
    const result = injectCallSites(`logger.warn('x');`, FILE, { srcRoot: SRC });

    expect(result?.map).toMatchObject({ version: 3, sources: [FILE] });
  });

  it('returns undefined when nothing matched', () => {
    expect(injectCallSites('const a = 1;', FILE, { srcRoot: SRC })).toBeUndefined();
  });
});

describe('isInstrumentable', () => {
  it.each([
    ['app TypeScript', `${SRC}/suppliers/SupplierBase.ts`, true],
    ['app TSX', `${SRC}/components/App.tsx`, true],
    ['a test', `${SRC}/utils/__tests__/Logger.test.ts`, false],
    ['a spec', `${SRC}/utils/foo.spec.ts`, false],
    ['a mock', `${SRC}/__mocks__/thing.ts`, false],
    ['a fixture', `${SRC}/__fixtures__/data.ts`, false],
    ['a declaration file', `${SRC}/types/app.d.ts`, false],
    ['the Logger itself', `${SRC}/utils/Logger.ts`, false],
    ['a file outside src', '/repo/tools/helper.ts', false],
    ['a JavaScript file', `${SRC}/legacy.js`, false],
  ])('%s: %s', (_label, file, expected) => {
    expect(isInstrumentable(file, SRC)).toBe(expected);
  });
});

describe('logCallSitesPlugin', () => {
  const plugin = logCallSitesPlugin({ levels: ['warn', 'error'], root: '/repo' });
  const transform = plugin.transform as unknown as (
    code: string,
    id: string,
  ) => { code: string } | undefined;

  it('runs before other plugins so it sees the original TypeScript', () => {
    expect(plugin.enforce).toBe('pre');
  });

  it('instruments a module and ignores a Vite query suffix on its id', () => {
    expect(transform(`logger.warn('x');`, `${FILE}?v=123`)?.code).toContain('warnAt(');
  });

  it.each([
    ['a module without a logger', `const a = 1;`, FILE],
    ['a test file', `logger.warn('x');`, `${SRC}/utils/__tests__/a.test.ts`],
    ['a file outside src', `logger.warn('x');`, '/repo/node_modules/dep/index.ts'],
  ])('skips %s', (_label, code, id) => {
    expect(transform(code, id)).toBeUndefined();
  });
});
