
import { CAS_REGEX, findCas, isCas } from '../cas'

describe('CAS_REGEX', () => {
  it('should be a valid regex', () =>
    expect(CAS_REGEX).toBeInstanceOf(RegExp)
  )
})

describe('isCas', () => {
  const testData = {
    '1234-56-6': true,
    '50-00-0': true,
    '1234-56-999': false,
    '1234-56': false,
    '1234-56-0': false,
    '0000-00-0': false,
    '00-10-0': false
  }

  for (const [input, output] of Object.entries(testData)) {
    it(`should return ${output} for CAS number: ${input}`, () =>
      expect(isCas(input)).toBe(output)
    )
  }
})


describe('findCas', () => {
  const testData = {
    'Example of a valid cas: 1234-56-6..': '1234-56-6',
    'and 50-00-0 is another valid cas #': '50-00-0',
    'Example of an invalid cas: 1232-56-6..': undefined,
    'and 50-00-1 is another valid cas #': undefined
  }

  for (const [input, output] of Object.entries(testData)) {
    it(`should return ${output} for content: ${input}`, () =>
      expect(findCas(input)).toBe(output)
    )
  }
})