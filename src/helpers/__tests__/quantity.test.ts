import { UOM_ALIASES } from "constants/app";
import { parseQuantity, standardizeUom } from "../quantity";

describe("standardizeUom", () => {
  for (const [output, testCases] of Object.entries(UOM_ALIASES)) {
    describe(`${output} aliases`, () => {
      for (const input of testCases) {
        it(`should return ${output} when standardizing: ${input}`, () =>
          expect(standardizeUom(input)).toBe(output));
      }
    });
  }
});

describe("parseQuantity", () => {
  const testData = {
    /* eslint-disable */
    "1": 1,
    "2.3": 2.3,
    "3,456.78": 3456.78,
    "9,123": 9123,
    "1.234,56": 1234.56,
    "0.001": 0.001,
    "1,2": 1.2,
    "1,234.56": 1234.56,
    "1,234,567.89": 1234567.89,
    /* eslint-enable */
  };

  for (const [uom, aliases] of Object.entries(UOM_ALIASES)) {
    describe(aliases.join("/"), () => {
      for (const alias of aliases) {
        for (const [input, output] of Object.entries(testData)) {
          it(`should return ${output} ${uom} when parsing: ${input} ${alias}`, () =>
            expect(parseQuantity(`${input} ${alias}`)).toMatchObject({ quantity: output, uom }));
        }
      }
    });
  }

  it(`should throw an Error when parsing: foobar`, () =>
    expect(() => parseQuantity("foobar")).toThrow("Failed to parse quantity"));
});
