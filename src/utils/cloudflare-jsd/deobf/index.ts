import { parse } from '@babel/parser';
import generate from '@babel/generator';
import type { Ctx } from '../types';
import { unrollMaps } from './unroll-maps';
import { sequenceUnroller } from './sequence-unroller';
import { replaceReassignments } from './replace-reassignments';
import { replaceStrings } from './replace-strings';
import { concatStrings } from './concat-strings';
import { parseScript } from './extract';

export function deobfuscateAndExtract(src: string): Ctx {
  const ast = parse(src, {
    sourceType: 'script',
    plugins: [],
  });

  unrollMaps(ast);
  sequenceUnroller(ast);

  const calleeName = replaceReassignments(ast);
  if (!calleeName) {
    throw new Error('Could not identify string decoder function');
  }

  replaceStrings(ast, calleeName);
  concatStrings(ast);

  // Optional: generate deobfuscated output for debugging
  // const output = generate(ast).code;
  // console.log(output);

  return parseScript(ast);
}

export { parseScript } from './extract';
