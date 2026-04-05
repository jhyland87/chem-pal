// LZ-string compression/decompression with custom alphabet support
// Ported from https://github.com/lazarus/lz-string-go

const DEFAULT_KEY_STR_BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

export function compress(
  uncompressed: string,
  keyStrBase64: string = DEFAULT_KEY_STR_BASE64,
): string {
  if (uncompressed.length === 0) return '';

  const charArr = [...keyStrBase64];
  let res = _compress([...uncompressed], 6, charArr);

  switch (res.length % 4) {
    case 3:
      return res + '=';
    case 2:
      return res + '==';
    case 1:
      return res + '===';
  }
  return res;
}

function _compress(
  uncompressed: string[],
  bitsPerChar: number,
  charArr: string[],
): string {
  if (uncompressed.length === 0) return '';

  let value: number;
  const contextDictionary: Map<string, number> = new Map();
  const contextDictionaryToCreate: Set<string> = new Set();
  let contextC: string;
  let contextW = '';
  let contextWc: string;
  let contextEnlargeIn = 2;
  let contextDictSize = 3;
  let contextNumBits = 2;
  let contextDataString = '';
  let contextDataVal = 0;
  let contextDataPosition = 0;

  for (let ii = 0; ii < uncompressed.length; ii++) {
    contextC = uncompressed[ii];

    if (!contextDictionary.has(contextC)) {
      contextDictionary.set(contextC, contextDictSize);
      contextDictSize++;
      contextDictionaryToCreate.add(contextC);
    }

    contextWc = contextW + contextC;
    if (contextDictionary.has(contextWc)) {
      contextW = contextWc;
    } else {
      if (contextDictionaryToCreate.has(contextW)) {
        const contextWRune = contextW.codePointAt(0)!;
        if (contextWRune < 256) {
          for (let i = 0; i < contextNumBits; i++) {
            contextDataVal <<= 1;
            if (contextDataPosition === bitsPerChar - 1) {
              contextDataPosition = 0;
              contextDataString += charArr[contextDataVal];
              contextDataVal = 0;
            } else {
              contextDataPosition++;
            }
          }
          value = contextWRune;
          for (let i = 0; i < 8; i++) {
            contextDataVal = (contextDataVal << 1) | (value & 1);
            if (contextDataPosition === bitsPerChar - 1) {
              contextDataPosition = 0;
              contextDataString += charArr[contextDataVal];
              contextDataVal = 0;
            } else {
              contextDataPosition++;
            }
            value >>= 1;
          }
        } else {
          value = 1;
          for (let i = 0; i < contextNumBits; i++) {
            contextDataVal = (contextDataVal << 1) | value;
            if (contextDataPosition === bitsPerChar - 1) {
              contextDataPosition = 0;
              contextDataString += charArr[contextDataVal];
              contextDataVal = 0;
            } else {
              contextDataPosition++;
            }
            value = 0;
          }
          value = contextWRune;
          for (let i = 0; i < 16; i++) {
            contextDataVal = (contextDataVal << 1) | (value & 1);
            if (contextDataPosition === bitsPerChar - 1) {
              contextDataPosition = 0;
              contextDataString += charArr[contextDataVal];
              contextDataVal = 0;
            } else {
              contextDataPosition++;
            }
            value >>= 1;
          }
        }
        contextEnlargeIn--;
        if (contextEnlargeIn === 0) {
          contextEnlargeIn = Math.pow(2, contextNumBits);
          contextNumBits++;
        }
        contextDictionaryToCreate.delete(contextW);
      } else {
        value = contextDictionary.get(contextW)!;
        for (let i = 0; i < contextNumBits; i++) {
          contextDataVal = (contextDataVal << 1) | (value & 1);
          if (contextDataPosition === bitsPerChar - 1) {
            contextDataPosition = 0;
            contextDataString += charArr[contextDataVal];
            contextDataVal = 0;
          } else {
            contextDataPosition++;
          }
          value >>= 1;
        }
      }
      contextEnlargeIn--;
      if (contextEnlargeIn === 0) {
        contextEnlargeIn = Math.pow(2, contextNumBits);
        contextNumBits++;
      }
      contextDictionary.set(contextWc, contextDictSize);
      contextDictSize++;
      contextW = contextC;
    }
  }

  if (contextW !== '') {
    if (contextDictionaryToCreate.has(contextW)) {
      const contextWRune = contextW.codePointAt(0)!;
      if (contextWRune < 256) {
        for (let i = 0; i < contextNumBits; i++) {
          contextDataVal <<= 1;
          if (contextDataPosition === bitsPerChar - 1) {
            contextDataPosition = 0;
            contextDataString += charArr[contextDataVal];
            contextDataVal = 0;
          } else {
            contextDataPosition++;
          }
        }
        value = contextWRune;
        for (let i = 0; i < 8; i++) {
          contextDataVal = (contextDataVal << 1) | (value & 1);
          if (contextDataPosition === bitsPerChar - 1) {
            contextDataPosition = 0;
            contextDataString += charArr[contextDataVal];
            contextDataVal = 0;
          } else {
            contextDataPosition++;
          }
          value >>= 1;
        }
      } else {
        value = 1;
        for (let i = 0; i < contextNumBits; i++) {
          contextDataVal = (contextDataVal << 1) | value;
          if (contextDataPosition === bitsPerChar - 1) {
            contextDataPosition = 0;
            contextDataString += charArr[contextDataVal];
            contextDataVal = 0;
          } else {
            contextDataPosition++;
          }
          value = 0;
        }
        value = contextWRune;
        for (let i = 0; i < 16; i++) {
          contextDataVal = (contextDataVal << 1) | (value & 1);
          if (contextDataPosition === bitsPerChar - 1) {
            contextDataPosition = 0;
            contextDataString += charArr[contextDataVal];
            contextDataVal = 0;
          } else {
            contextDataPosition++;
          }
          value >>= 1;
        }
      }
      contextEnlargeIn--;
      if (contextEnlargeIn === 0) {
        contextEnlargeIn = Math.pow(2, contextNumBits);
        contextNumBits++;
      }
      contextDictionaryToCreate.delete(contextW);
    } else {
      value = contextDictionary.get(contextW)!;
      for (let i = 0; i < contextNumBits; i++) {
        contextDataVal = (contextDataVal << 1) | (value & 1);
        if (contextDataPosition === bitsPerChar - 1) {
          contextDataPosition = 0;
          contextDataString += charArr[contextDataVal];
          contextDataVal = 0;
        } else {
          contextDataPosition++;
        }
        value >>= 1;
      }
    }
    contextEnlargeIn--;
    if (contextEnlargeIn === 0) {
      contextEnlargeIn = Math.pow(2, contextNumBits);
      contextNumBits++;
    }
  }

  value = 2;
  for (let i = 0; i < contextNumBits; i++) {
    contextDataVal = (contextDataVal << 1) | (value & 1);
    if (contextDataPosition === bitsPerChar - 1) {
      contextDataPosition = 0;
      contextDataString += charArr[contextDataVal];
      contextDataVal = 0;
    } else {
      contextDataPosition++;
    }
    value >>= 1;
  }

  for (;;) {
    contextDataVal <<= 1;
    if (contextDataPosition === bitsPerChar - 1) {
      contextDataString += charArr[contextDataVal];
      break;
    } else {
      contextDataPosition++;
    }
  }

  return contextDataString;
}

// Decompress

const baseReverseDic: Map<string, Map<number, number>> = new Map();

interface DataStruct {
  input: string;
  alphabet: string;
  val: number;
  position: number;
  index: number;
  dictionary: string[];
  enlargeIn: number;
  numBits: number;
}

function convertToBaseReverseDic(alphabet: string): Map<number, number> {
  const val = new Map<number, number>();
  const charArr = [...alphabet];
  for (let i = 0; i < charArr.length; i++) {
    val.set(charArr[i].charCodeAt(0), i);
  }
  return val;
}

function getBaseValue(alphabet: string, charCode: number): number {
  let arr = baseReverseDic.get(alphabet);
  if (!arr) {
    arr = convertToBaseReverseDic(alphabet);
    baseReverseDic.set(alphabet, arr);
  }
  return arr.get(charCode) ?? 0;
}

function readBits(nb: number, data: DataStruct): number {
  let result = 0;
  let power = 1;
  for (let i = 0; i < nb; i++) {
    const respB = data.val & data.position;
    data.position = Math.floor(data.position / 2);
    if (data.position === 0) {
      data.position = 32;
      data.val = getBaseValue(data.alphabet, data.input.charCodeAt(data.index));
      data.index++;
    }
    if (respB > 0) {
      result |= power;
    }
    power *= 2;
  }
  return result;
}

function appendValue(data: DataStruct, str: string): void {
  data.dictionary.push(str);
  data.enlargeIn--;
  if (data.enlargeIn === 0) {
    data.enlargeIn = Math.pow(2, data.numBits);
    data.numBits++;
  }
}

function getString(
  last: string,
  data: DataStruct,
): { value: string; isEnd: boolean } {
  const c = readBits(data.numBits, data);
  switch (c) {
    case 0: {
      const str = String.fromCodePoint(readBits(8, data));
      appendValue(data, str);
      return { value: str, isEnd: false };
    }
    case 1: {
      const str = String.fromCodePoint(readBits(16, data));
      appendValue(data, str);
      return { value: str, isEnd: false };
    }
    case 2:
      return { value: '', isEnd: true };
  }

  if (c < data.dictionary.length) {
    return { value: data.dictionary[c], isEnd: false };
  }
  if (c === data.dictionary.length) {
    const firstRune = [...last][0] ?? '';
    return { value: last + firstRune, isEnd: false };
  }
  throw new Error('bad character encoding');
}

function concatWithFirstRune(str: string, getFirstRune: string): string {
  const firstChar = [...getFirstRune][0] ?? '';
  return str + firstChar;
}

export function decompress(
  input: string,
  keyStrBase64: string = DEFAULT_KEY_STR_BASE64,
): string {
  const data: DataStruct = {
    input,
    alphabet: keyStrBase64,
    val: getBaseValue(keyStrBase64, input.charCodeAt(0)),
    position: 32,
    index: 1,
    dictionary: ['0', '1', '2'],
    enlargeIn: 5,
    numBits: 2,
  };

  const first = getString('', data);
  if (first.isEnd) return first.value;

  let result = first.value;
  let last = result;
  data.numBits++;

  for (;;) {
    const { value: str, isEnd } = getString(last, data);
    if (isEnd) return result;

    result += str;
    appendValue(data, concatWithFirstRune(last, str));
    last = str;
  }
}
