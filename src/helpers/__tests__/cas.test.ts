import { CAS_REGEX } from "@/constants/common";
import { findCAS, isCAS } from "@/helpers/cas";
describe("CAS_REGEX", () => {
  it("should be a valid regex", () => expect(CAS_REGEX).toBeInstanceOf(RegExp));
});

describe("isCAS", () => {
  test.each([
    ["1234-56-6", true],
    ["50-00-0", true],
    ["1234-56-999", false],
    ["1234-56", false],
    ["1234-56-0", false],
    ["0000-00-0", false],
    ["00-10-0", false],
  ])("should return %s for CAS number: %s", (input, output) => expect(isCAS(input)).toBe(output));
});

describe("findCAS", () => {
  test.each([
    ["Example of a valid cas: 1234-56-6..", "1234-56-6"],
    ["and 50-00-0 is another valid cas #", "50-00-0"],
    ["Example of an invalid cas: 1232-56-6..", undefined],
    ["and 50-00-1 is another valid cas #", undefined],
  ])("should return %s for content: %s", (input, output) => expect(findCAS(input)).toBe(output));
});
