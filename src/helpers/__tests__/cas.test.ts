
import { CAS_REGEX, findCas, isCas } from '../cas'

describe('CAS_REGEX', () => {
  it('should be a valid regex', () => {
    expect(CAS_REGEX).toBeInstanceOf(RegExp)
  })
})

describe('isCas', () => {
  Object.entries({
    "1234-56-6": true,
    "50-00-0": true,
    "1234-56-999": false,
    "1234-56": false,
    "1234-56-0": false,
    "0000-00-0": false,
    "00-10-0": false
  }).forEach(([cas, expected]) => {
    it(`should return ${expected} for CAS number: ${cas}`, () => {
      expect(isCas(cas)).toBe(expected)
    })
  })
})


describe('findCas', () => {
  Object.entries({
    'Example of a valid cas: 1234-56-6..': '1234-56-6',
    'and 50-00-0 is another valid cas #': '50-00-0',
    'Example of an invalid cas: 1232-56-6..': undefined,
    'and 50-00-1 is another valid cas #': undefined
  }).forEach(([content, result]) => {
    it(`should return ${result} for content: ${content}`, () => {
      expect(findCas(content)).toBe(result)
    })
  })
})