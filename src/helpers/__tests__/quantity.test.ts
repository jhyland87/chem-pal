import { parseQuantity, standardizeUom, uomAliases } from '../quantity'


describe('standardizeUom', () => {
  for (const [expected, testCases] of Object.entries(uomAliases)) {
    describe(`${expected} aliases`, () => {
      for (const testCase of testCases) {
        it(`should return ${expected} when standardizing: ${testCase}`, () =>
          expect(standardizeUom(testCase)).toBe(expected)
        )
      }
    })
  }
});


describe('parseQuantity', () => {
  const testData = {
    '1': 1,
    '2.3': 2.3,
    '3,456.78': 3456.78,
    '9,123': 9123,
    '1.234,56': 1234.56,
    '0.001': 0.001,
    '1,2': 1.2,
    '1,234.56': 1234.56,
    '1,234,567.89': 1234567.89,
  }

  for (const [uom, aliases] of Object.entries(uomAliases)) {
    describe(aliases.join('/'), () => {
      for (const alias of aliases) {
        for (const [value, expectedQuantity] of Object.entries(testData)) {
          it(`should return ${expectedQuantity} ${uom} when parsing: ${value} ${alias}`, () =>
            expect(parseQuantity(`${value} ${alias}`)).toMatchObject({ quantity: expectedQuantity, uom })
          )
        }
      }
    })
  }

  it(`should throw an Error when parsing: foobar`, () =>
    expect(() => parseQuantity('foobar')).toThrow('Failed to parse quantity')
  );
})