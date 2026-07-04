import { Pubchem } from "@/utils/Pubchem";
import { afterEach, describe, expect, it, vi } from "vitest";

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const compoundBody = { status: {}, total: 1, dictionary_terms: { compound: ["aspirin"] } };
const cidBody = { ConceptsAndCIDs: { CID: [2244] } };
const sdqBody = { SDQOutputSet: [{ rows: [{ cmpdname: "2-acetyloxybenzoic acid" }] }] };

describe("Pubchem", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getCompound", () => {
    it("returns the first autocomplete match", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(compoundBody));
      const result = await new Pubchem("aspirin").getCompound();
      expect(result).toBe("aspirin");
    });

    it("URL-encodes the query in the request", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(compoundBody));
      global.fetch = fetchMock;
      await new Pubchem("sodium chloride").getCompound();
      expect(fetchMock.mock.calls[0][0]).toContain("sodium%20chloride");
    });

    it("returns undefined and logs when the response is invalid", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ total: "nope" }));
      const result = await new Pubchem("aspirin").getCompound();
      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith("Error fetching compound:", expect.any(Error));
    });

    it("returns undefined when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("boom"));
      const result = await new Pubchem("aspirin").getCompound();
      expect(result).toBeUndefined();
    });

    it("returns undefined for each distinct invalid-compound shape", async () => {
      const badBodies = [
        null,
        { status: {}, total: 1 }, // missing dictionary_terms
        { status: {}, total: 1, dictionary_terms: { compound: [] } }, // empty array
        { status: {}, total: 1, dictionary_terms: { compound: [42] } }, // non-string entry
        { status: {} }, // missing total
      ];
      for (const body of badBodies) {
        global.fetch = vi.fn().mockResolvedValue(jsonResponse(body));
        expect(await new Pubchem("x").getCompound()).toBeUndefined();
      }
    });
  });

  describe("getCID", () => {
    it("resolves the CID from the compound name", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(compoundBody))
        .mockResolvedValueOnce(jsonResponse(cidBody));
      const result = await new Pubchem("aspirin").getCID();
      expect(result).toBe(2244);
    });

    it("returns undefined when no compound is found", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ total: "bad" }));
      const result = await new Pubchem("nonexistent").getCID();
      expect(result).toBeUndefined();
    });

    it("returns undefined and logs when the CID response is invalid", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(compoundBody))
        .mockResolvedValueOnce(jsonResponse({ ConceptsAndCIDs: { CID: [] } }));
      const result = await new Pubchem("aspirin").getCID();
      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith("Error fetching CID:", expect.any(Error));
    });

    it("returns undefined for each distinct invalid-CID shape", async () => {
      const badBodies = [
        null,
        { foo: 1 }, // missing ConceptsAndCIDs
        { ConceptsAndCIDs: { CID: "nope" } }, // CID not an array
        { ConceptsAndCIDs: { CID: ["x"] } }, // non-number entry
      ];
      for (const body of badBodies) {
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce(jsonResponse(compoundBody))
          .mockResolvedValueOnce(jsonResponse(body));
        expect(await new Pubchem("x").getCID()).toBeUndefined();
      }
    });
  });

  describe("querySdqAgent", () => {
    it("returns the SDQ response on success", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(sdqBody));
      const result = await new Pubchem("aspirin").querySdqAgent({ cid: 2244 });
      expect(result).toEqual(sdqBody);
    });

    it("builds a percent-encoded query URL", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(sdqBody));
      global.fetch = fetchMock;
      await new Pubchem("aspirin").querySdqAgent({ cid: 2244 });
      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain("/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=");
      expect(url).toContain("%22"); // encoded double quotes
      expect(url).not.toContain('"');
    });

    it("returns undefined and logs when the SDQ response is invalid", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ notSdq: true }));
      const result = await new Pubchem("aspirin").querySdqAgent({ cid: 1 });
      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith("Error querying SDQ agent:", expect.any(Error));
    });

    it("returns undefined for each distinct invalid-SDQ shape", async () => {
      const badBodies = [null, { foo: 1 }, { SDQOutputSet: "nope" }];
      for (const body of badBodies) {
        global.fetch = vi.fn().mockResolvedValue(jsonResponse(body));
        expect(await new Pubchem("x").querySdqAgent({ cid: 1 })).toBeUndefined();
      }
    });
  });

  describe("getSimpleName", () => {
    it("returns the compound name from the SDQ result", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(compoundBody)) // getCompound
        .mockResolvedValueOnce(jsonResponse(cidBody)) // getCID
        .mockResolvedValueOnce(jsonResponse(sdqBody)); // querySdqAgent
      const result = await new Pubchem("2-Acetoxybenzenecarboxylic acid").getSimpleName();
      expect(result).toBe("2-acetyloxybenzoic acid");
    });

    it("returns undefined when the CID cannot be resolved", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ total: "bad" }));
      const result = await new Pubchem("nonexistent").getSimpleName();
      expect(result).toBeUndefined();
    });

    it("returns undefined when the SDQ query yields nothing", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(compoundBody))
        .mockResolvedValueOnce(jsonResponse(cidBody))
        .mockResolvedValueOnce(jsonResponse({ notSdq: true }));
      const result = await new Pubchem("aspirin").getSimpleName();
      expect(result).toBeUndefined();
    });
  });

  describe("getCompoundNameFromAlias", () => {
    it("returns the compound name for an alias", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse(sdqBody));
      const result = await new Pubchem("aspirin").getCompoundNameFromAlias("acetylsalicylic acid");
      expect(result).toBe("2-acetyloxybenzoic acid");
    });

    it("returns undefined when the SDQ query yields nothing", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonResponse({ notSdq: true }));
      const result = await new Pubchem("aspirin").getCompoundNameFromAlias("bad-alias");
      expect(result).toBeUndefined();
    });
  });
});
