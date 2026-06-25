import {
  getRankedNamesByName,
  isSimpleName,
  suggestAlternativeSearch,
} from "@/helpers/pubchem";
import { afterEach, beforeAll, beforeEach, describe, expect, it, test, vi, type Mock } from "vitest";
import { ACETONE, ASPIRIN } from "./fixtures/chemicals";

function mockSynonymsFetch(synonyms?: string[]): void {
  (global.fetch as Mock).mockImplementation(() =>
    Promise.resolve({
      ok: synonyms !== undefined,
      json: () =>
        Promise.resolve(
          synonyms === undefined
            ? {}
            : { InformationList: { Information: [{ Synonym: synonyms }] } },
        ),
    } as unknown as Response),
  );
}

describe("PubChem Helpers", () => {
  describe("isSimpleName", () => {
    test.each([
      ["acetone", true],
      ["aspirin", true],
      ["sulfuric acid", true],
      ["2-acetyloxybenzoic acid", false],
      ["propan-2-one", false],
      ["NSC 7896", false],
      ["a", false],
      ["this is an extremely long technical chemical name", false],
    ])("should return %s for: %s", (input, output) => expect(isSimpleName(input)).toBe(output));
  });

  describe("getRankedNamesByName", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it("returns the ranked synonym list when found", async () => {
      mockSynonymsFetch(ACETONE.rankedSynonyms());
      const result = await getRankedNamesByName(ACETONE.name);
      expect(result).toEqual(ACETONE.rankedSynonyms());
    });

    it("returns undefined on a 404 (unknown name)", async () => {
      mockSynonymsFetch(undefined);
      const result = await getRankedNamesByName("zzqqxxnotathing");
      expect(result).toBeUndefined();
    });
  });

  describe("suggestAlternativeSearch", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      mockSynonymsFetch(ACETONE.rankedSynonyms());
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it("suggests the most popular simple name for a technical query", async () => {
      const result = await suggestAlternativeSearch("2-propanone", new Set(["2-propanone"]));
      expect(result.name).toBe(ACETONE.name);
      expect(result.cas).toBe(ACETONE.cas);
    });

    it("does not suggest obscure deep-ranked synonyms; offers the CAS instead", async () => {
      // "acetone" (the popular name) already failed, so it is excluded. The deepest alias is a
      // perfectly simple name, yet it sits outside the popularity window and must NOT be
      // suggested — proving the window (not isSimpleName) is what filters it out.
      expect(isSimpleName(ACETONE.leastCommonName())).toBe(true);
      const result = await suggestAlternativeSearch(ACETONE.name, new Set([ACETONE.name]));
      expect(result.name).toBeUndefined();
      expect(result.cas).toBe(ACETONE.cas);
    });

    it("never re-suggests a name that previously yielded no results (no A→B→A loop)", async () => {
      const result = await suggestAlternativeSearch("2-propanone", new Set(["2-propanone", ACETONE.name]));
      expect(result.name).not.toBe(ACETONE.name);
    });

    it("lowercases an all-caps common name for display", async () => {
      // Aspirin's #2 synonym is the all-caps "ACETYLSALICYLIC ACID"; when "aspirin" itself is
      // excluded it should be suggested, but tidied to lowercase.
      mockSynonymsFetch(ASPIRIN.rankedSynonyms());
      const result = await suggestAlternativeSearch(ASPIRIN.name, new Set([ASPIRIN.name]));
      expect(result.name).toBe("acetylsalicylic acid");
      expect(result.cas).toBe(ASPIRIN.cas);
    });

    it("returns no name when only complicated names remain, but offers the CAS", async () => {
      // A response of nothing but the CAS and technical (non-simple) names.
      mockSynonymsFetch([ACETONE.cas, ...ACETONE.complicatedNames()]);
      const result = await suggestAlternativeSearch(ACETONE.name, new Set([ACETONE.name]));
      expect(result.name).toBeUndefined();
      expect(result.cas).toBe(ACETONE.cas);
    });

    it("returns an empty object when PubChem has no match", async () => {
      mockSynonymsFetch(undefined);
      const result = await suggestAlternativeSearch("zzqqxxnotathing", new Set());
      expect(result).toEqual({});
    });
  });
});
