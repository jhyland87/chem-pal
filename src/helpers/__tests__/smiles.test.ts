import {
  isProbablyValidSmiles,
  looksLikeSmiles,
  parseStructurePrefix,
  resolveQueryForSearch,
  resolveSmiles,
} from "@/helpers/smiles";
import { Cactus } from "@/utils/Cactus";
import { afterEach, beforeAll, beforeEach, describe, expect, it, test, vi, type Mock } from "vitest";
import { ETHANOL } from "./fixtures/chemicals";

/**
 * Builds a fake fetch that answers Cactus endpoint requests and PubChem SDQ requests.
 * Cactus URLs are decoded so they can be matched against the raw SMILES + endpoint segment.
 */
function mockChemFetch(
  cactus: Record<string, Partial<Record<"names" | "cas" | "stdinchikey", string>>>,
  pubchemName?: string,
): void {
  (global.fetch as Mock).mockImplementation((url: string) => {
    if (url.includes("sdqagent.cgi")) {
      const rows = pubchemName ? [{ cmpdname: pubchemName }] : [];
      return Promise.resolve({
        json: () =>
          Promise.resolve({
            SDQOutputSet: [{ status: { code: 0 }, totalCount: rows.length, rows }],
          }),
      } as unknown as Response);
    }

    const decoded = decodeURIComponent(url);
    let result = "";
    for (const [smiles, endpoints] of Object.entries(cactus)) {
      const base = `/structure/${smiles}/`;
      if (!decoded.includes(base)) continue;
      if (decoded.endsWith("/names")) result = endpoints.names ?? "";
      else if (decoded.endsWith("/cas")) result = endpoints.cas ?? "";
      else if (decoded.endsWith("/stdinchikey")) result = endpoints.stdinchikey ?? "";
    }
    return Promise.resolve({
      status: 200,
      clone: () => ({ headers: { get: () => "text/plain" } }),
      headers: { get: () => "text/plain" },
      text: () => Promise.resolve(result),
    } as unknown as Response);
  });
}

describe("SMILES Helpers", () => {
  describe("looksLikeSmiles", () => {
    test.each([
      ["CCO", true],
      ["CC(=O)O", true],
      ["c1ccccc1", true],
      ["[Na+].[Cl-]", true],
      ["O=C=O", true],
      ["ethanol", false],
      ["sulfuric acid", false],
      ["64-17-5", false],
      ["CO", false],
      ["", false],
    ])("should return %s for query: %s", (input, output) =>
      expect(looksLikeSmiles(input)).toBe(output),
    );
  });

  describe("parseStructurePrefix", () => {
    test.each([
      ["smiles:CCO", { mode: "smiles", value: "CCO" }],
      ["SMILES: CCO ", { mode: "smiles", value: "CCO" }],
      ["inchikey:LFQSCWFLJHTTHZ-UHFFFAOYSA-N", { mode: "inchikey", value: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N" }],
      ["ethanol", { mode: "auto", value: "ethanol" }],
    ])("should parse %s", (input, output) => expect(parseStructurePrefix(input)).toEqual(output));
  });

  describe("isProbablyValidSmiles", () => {
    test.each([
      ["CC(=O)O", true],
      ["[Na+].[Cl-]", true],
      ["CC(=O", false],
      ["C[C", false],
      ["hello!", false],
      ["", false],
    ])("should return %s for: %s", (input, output) =>
      expect(isProbablyValidSmiles(input)).toBe(output),
    );
  });

  describe("resolveSmiles", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      Cactus.clearGlobalCache();
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it("resolves a SMILES to a name, CAS, and InChIKey via Cactus", async () => {
      mockChemFetch({
        [ETHANOL.smiles]: {
          names: `${ETHANOL.name}\nethyl alcohol`,
          cas: ETHANOL.cas,
          stdinchikey: `InChIKey=${ETHANOL.inchikey}`,
        },
      });
      const result = await resolveSmiles(ETHANOL.smiles);
      expect(result).toEqual({
        name: ETHANOL.name,
        cas: [ETHANOL.cas],
        inchikey: ETHANOL.inchikey,
        source: "cactus-name",
      });
    });

    it("falls back to PubChem when Cactus yields only an InChIKey", async () => {
      mockChemFetch(
        {
          "C1=CC=CC=C1": {
            names: "",
            cas: "",
            stdinchikey: "UHOVQNZJYSORNB-UHFFFAOYSA-N",
          },
        },
        "benzene",
      );
      const result = await resolveSmiles("C1=CC=CC=C1");
      expect(result).toEqual({
        name: "benzene",
        inchikey: "UHOVQNZJYSORNB-UHFFFAOYSA-N",
        source: "pubchem-inchikey",
      });
    });

    it("returns undefined for an invalid SMILES without hitting the network", async () => {
      const result = await resolveSmiles("CC(=O");
      expect(result).toBeUndefined();
      expect(global.fetch as Mock).not.toHaveBeenCalled();
    });

    it("returns undefined when nothing resolves", async () => {
      mockChemFetch({ Xx: {} });
      const result = await resolveSmiles("Xx");
      expect(result).toBeUndefined();
    });
  });

  describe("resolveQueryForSearch", () => {
    beforeAll(() => {
      global.fetch = vi.fn() as Mock;
    });

    beforeEach(() => {
      Cactus.clearGlobalCache();
    });

    afterEach(() => {
      (global.fetch as Mock).mockReset();
    });

    it("resolves a SMILES query to a searchable name", async () => {
      mockChemFetch({ CCO: { names: "ethanol", cas: "64-17-5", stdinchikey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N" } });
      const result = await resolveQueryForSearch("CCO");
      expect(result.searchTerm).toBe("ethanol");
      expect(result.structure?.source).toBe("cactus-name");
    });

    it("passes non-structure queries through unchanged without a network call", async () => {
      const result = await resolveQueryForSearch("sulfuric acid");
      expect(result).toEqual({ searchTerm: "sulfuric acid" });
      expect(global.fetch as Mock).not.toHaveBeenCalled();
    });

    it("honors the smiles: prefix for an otherwise-ambiguous token", async () => {
      mockChemFetch({ CO: { names: "carbon monoxide", cas: "630-08-0", stdinchikey: "UGFAIRIUMAVXCW-UHFFFAOYSA-N" } });
      const result = await resolveQueryForSearch("smiles:CO");
      expect(result.searchTerm).toBe("carbon monoxide");
    });
  });
});
