import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import Cactus from "../Cactus";

describe("Cactus", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    // Mock fetch globally
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Clear any existing global cache
    Cactus.clearGlobalCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
    Cactus.clearGlobalCache();
  });

  describe("constructor", () => {
    it("should create instance with valid chemical name", () => {
      const cactus = new Cactus("aspirin");
      expect(cactus).toBeInstanceOf(Cactus);
    });

    it("should throw error when no chemical name provided", () => {
      expect(() => new Cactus("")).toThrow("Chemical name is required");
    });

    it("should create instance with XML format enabled", () => {
      const cactus = new Cactus("aspirin", true);
      expect(cactus).toBeInstanceOf(Cactus);
    });

    it("should create instance with custom cache options", () => {
      const cactus = new Cactus("aspirin", false, { max: 50, ttl: 60000, enabled: true });
      expect(cactus).toBeInstanceOf(Cactus);
    });

    it("should create instance with caching disabled", () => {
      const cactus = new Cactus("aspirin", false, { enabled: false });
      expect(cactus).toBeInstanceOf(Cactus);
    });
  });

  describe("setFormatXML", () => {
    it("should set XML format", () => {
      const cactus = new Cactus("aspirin");
      cactus.setFormatXML(true);
      // We can't directly test the private property, but we can test the behavior
      // by calling a method that uses it
    });
  });

  describe("clearCache", () => {
    it("should clear instance cache", () => {
      const cactus = new Cactus("aspirin");
      cactus.clearCache();
      // Test that cache is cleared by checking stats
      expect(cactus.getCacheStats().size).toBe(0);
    });
  });

  describe("clearGlobalCache", () => {
    it("should clear global cache", () => {
      Cactus.clearGlobalCache();
      // This is a static method, so we just test it doesn't throw
      expect(() => Cactus.clearGlobalCache()).not.toThrow();
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics when cache is enabled", () => {
      const cactus = new Cactus("aspirin");
      const stats = cactus.getCacheStats();
      expect(stats).toHaveProperty("size");
      expect(typeof stats.size).toBe("number");
    });

    it("should return zero size when cache is disabled", () => {
      const cactus = new Cactus("aspirin", false, { enabled: false });
      const stats = cactus.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("API methods", () => {
    let cactus: Cactus;

    beforeEach(() => {
      cactus = new Cactus("aspirin");
    });

    describe("getNames", () => {
      it("should return array of names for valid response", async () => {
        const mockResponse = "aspirin\nacetylsalicylic acid\n50-78-2";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getNames();
        expect(result).toEqual(["aspirin", "acetylsalicylic acid", "50-78-2"]);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/names",
        );
      });

      it("should return undefined for empty response", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(""),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getNames();
        expect(result).toBeUndefined();
      });

      it("should return undefined for single empty line", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve("\n"),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getNames();
        expect(result).toBeUndefined();
      });

      it("should handle non-200 status", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 404,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(undefined),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getNames();
        expect(result).toBeUndefined();
      });
    });

    describe("getSimpleNames", () => {
      it("should filter names to simple format", async () => {
        const mockResponse = "aspirin\nacetylsalicylic acid\n50-78-2\n2-acetyloxybenzoic acid";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSimpleNames();
        expect(result).toEqual(["aspirin", "acetylsalicylic acid"]);
      });

      it("should respect limit parameter", async () => {
        const mockResponse = "aspirin\nacetylsalicylic acid\nacetoxybenzoic acid\nbenzoic acid";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSimpleNames(2);
        expect(result).toEqual(["aspirin", "acetylsalicylic acid"]);
      });

      it("should return undefined when no simple names found", async () => {
        const mockResponse = "50-78-2\n11126-35-5\n2-acetyloxybenzoic acid";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSimpleNames();
        expect(result).toBeUndefined();
      });

      it("should return undefined when getNames returns undefined", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(""),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSimpleNames();
        expect(result).toBeUndefined();
      });

      it("should return undefined when getNames returns empty array", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve("\n"),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSimpleNames();
        expect(result).toBeUndefined();
      });
    });

    describe("getSmiles", () => {
      it("should return SMILES string", async () => {
        const mockResponse = "CC(=O)Oc1ccccc1C(O)=O";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getSmiles();
        expect(result).toBe("CC(=O)Oc1ccccc1C(O)=O");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/smiles",
        );
      });
    });

    describe("getInchi", () => {
      it("should return InChI string", async () => {
        const mockResponse = "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getInchi();
        expect(result).toBe("InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/inchi",
        );
      });
    });

    describe("getInchiKey", () => {
      it("should return InChI Key", async () => {
        const mockResponse = "BSYNRYMUTXBXSQ-UHFFFAOYSA-N";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getInchiKey();
        expect(result).toBe("BSYNRYMUTXBXSQ-UHFFFAOYSA-N");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/inchikey",
        );
      });
    });

    describe("getFicts", () => {
      it("should return FICTS identifier", async () => {
        const mockResponse = "FICTS identifier";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getFicts();
        expect(result).toBe("FICTS identifier");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/ficts",
        );
      });
    });

    describe("getFicus", () => {
      it("should return FICUS identifier", async () => {
        const mockResponse = "FICUS identifier";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getFicus();
        expect(result).toBe("FICUS identifier");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/ficus",
        );
      });
    });

    describe("getUuuuu", () => {
      it("should return UUUUU identifier", async () => {
        const mockResponse = "UUUUU identifier";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getUuuuu();
        expect(result).toBe("UUUUU identifier");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/uuuuu",
        );
      });
    });

    describe("getHASHISY", () => {
      it("should return HASHISY identifier", async () => {
        const mockResponse = "HASHISY identifier";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getHASHISY();
        expect(result).toBe("HASHISY identifier");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/hashisy",
        );
      });
    });

    describe("getFile", () => {
      it("should return file content for SDF format", async () => {
        const mockResponse = "SDF file content";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve(mockResponse),
        });

        const result = await cactus.getFile("sdf");
        expect(result).toBe("SDF file content");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/file?format=sdf",
        );
      });

      it("should include remove_hydrogens parameter when specified", async () => {
        const mockResponse = "SDF file content without hydrogens";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve(mockResponse),
        });

        const result = await cactus.getFile("sdf", true);
        expect(result).toBe("SDF file content without hydrogens");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/file?format=sdf&operator=remove_hydrogens",
        );
      });

      it("should handle non-200 status", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 404,
          text: () => Promise.resolve(""),
        });

        const result = await cactus.getFile("sdf");
        expect(result).toBe("");
      });
    });

    describe("getFileSDF", () => {
      it("should return SDF file content", async () => {
        const mockResponse = "SDF file content";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve(mockResponse),
        });

        const result = await cactus.getFileSDF();
        expect(result).toBe("SDF file content");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/file?format=sdf",
        );
      });
    });

    describe("getFileJME", () => {
      it("should return JME file content", async () => {
        const mockResponse = "JME file content";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve(mockResponse),
        });

        const result = await cactus.getFileJME();
        expect(result).toBe("JME file content");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/file?format=jme",
        );
      });
    });

    describe("getIUPACName", () => {
      it("should return IUPAC name", async () => {
        const mockResponse = "2-acetyloxybenzoic acid";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getIUPACName();
        expect(result).toBe("2-acetyloxybenzoic acid");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/iupac_name",
        );
      });

      it("should return undefined for empty response", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(""),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getIUPACName();
        expect(result).toBeUndefined();
      });
    });

    describe("getCAS", () => {
      it("should return array of CAS numbers", async () => {
        const mockResponse = "50-78-2\n11126-35-5\n11126-37-7";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getCAS();
        expect(result).toEqual(["50-78-2", "11126-35-5", "11126-37-7"]);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/cas",
        );
      });
    });

    describe("getChemspiderID", () => {
      it("should return ChemSpider ID", async () => {
        const mockResponse = "2157";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getChemspiderID();
        expect(result).toBe("2157");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/chemspider_id",
        );
      });
    });

    describe("getStdinchiKey", () => {
      it("should return standardized InChI Key", async () => {
        const mockResponse = "BSYNRYMUTXBXSQ-UHFFFAOYSA-N";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getStdinchiKey();
        expect(result).toBe("BSYNRYMUTXBXSQ-UHFFFAOYSA-N");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/stdinchikey",
        );
      });
    });

    describe("getStdinchi", () => {
      it("should return standardized InChI", async () => {
        const mockResponse = "InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getStdinchi();
        expect(result).toBe("InChI=1S/C9H8O4/c1-6(10)13-8-5-3-2-4-7(8)9(11)12/h2-5H,1H3,(H,11,12)");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/stdinchi",
        );
      });
    });

    describe("getImage", () => {
      it("should return image blob", async () => {
        const mockBlob = new Blob(["image data"], { type: "image/png" });
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "image/png"]]),
          blob: () => Promise.resolve(mockBlob),
          clone: () => ({
            headers: new Map([["content-type", "image/png"]]),
          }),
        });

        const result = await cactus.getImage();
        expect(result).toBeInstanceOf(Blob);
        expect(result).toBe(mockBlob);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/image",
        );
      });

      it("should return undefined for non-blob response", async () => {
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve("not an image"),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getImage();
        expect(result).toBeUndefined();
      });
    });

    describe("getTwirl", () => {
      it("should return TWIRL identifier", async () => {
        const mockResponse = "TWIRL HTML content";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getTwirl();
        expect(result).toBe("TWIRL HTML content");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/twirl",
        );
      });
    });

    describe("getMW", () => {
      it("should return molecular weight", async () => {
        const mockResponse = "180.1598";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getMW();
        expect(result).toBe("180.1598");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/mw",
        );
      });
    });

    describe("getFormula", () => {
      it("should return molecular formula", async () => {
        const mockResponse = "C9H8O4";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getFormula();
        expect(result).toBe("C9H8O4");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/formula",
        );
      });
    });

    describe("getHbondDonorCount", () => {
      it("should return hydrogen bond donor count", async () => {
        const mockResponse = "1";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getHbondDonorCount();
        expect(result).toBe("1");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/h_bond_donor_count",
        );
      });
    });

    describe("getHbondAcceptorCount", () => {
      it("should return hydrogen bond acceptor count", async () => {
        const mockResponse = "4";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getHbondAcceptorCount();
        expect(result).toBe("4");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/h_bond_acceptor_count",
        );
      });
    });

    describe("getHbondCenterCount", () => {
      it("should return hydrogen bond center count", async () => {
        const mockResponse = "4";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getHbondCenterCount();
        expect(result).toBe("4");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/h_bond_center_count",
        );
      });
    });

    describe("getRuleOf5ViolationCount", () => {
      it("should return Rule of Five violation count", async () => {
        const mockResponse = "0";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getRuleOf5ViolationCount();
        expect(result).toBe("0");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/rule_of_5_violation_count",
        );
      });
    });

    describe("getRotorCount", () => {
      it("should return rotatable bond count", async () => {
        const mockResponse = "3";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getRotorCount();
        expect(result).toBe("3");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/rotor_count",
        );
      });
    });

    describe("getEffectiveRotorCount", () => {
      it("should return effective rotatable bond count", async () => {
        const mockResponse = "3.0";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getEffectiveRotorCount();
        expect(result).toBe("3.0");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/effective_rotor_count",
        );
      });
    });

    describe("getRingCount", () => {
      it("should return ring count", async () => {
        const mockResponse = "1";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getRingCount();
        expect(result).toBe("1");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/ring_count",
        );
      });
    });

    describe("getRingsysCount", () => {
      it("should return ring system count", async () => {
        const mockResponse = "1";
        mockFetch.mockResolvedValueOnce({
          status: 200,
          headers: new Map([["content-type", "text/plain"]]),
          text: () => Promise.resolve(mockResponse),
          clone: () => ({
            headers: new Map([["content-type", "text/plain"]]),
          }),
        });

        const result = await cactus.getRingsysCount();
        expect(result).toBe("1");
        expect(mockFetch).toHaveBeenCalledWith(
          "https://cactus.nci.nih.gov/chemical/structure/aspirin/ringsys_count",
        );
      });
    });
  });

  describe("caching behavior", () => {
    it("should cache responses when enabled", async () => {
      const cactus = new Cactus("aspirin");
      const mockResponse = "cached response";

      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve(mockResponse),
        clone: () => ({
          headers: new Map([["content-type", "text/plain"]]),
        }),
      });

      // First call should hit the API
      const result1 = await cactus.getSmiles();
      expect(result1).toBe("cached response");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await cactus.getSmiles();
      expect(result2).toBe("cached response");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("should not cache responses when disabled", async () => {
      const cactus = new Cactus("aspirin", false, { enabled: false });
      const mockResponse = "response";

      mockFetch.mockResolvedValue({
        status: 200,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve(mockResponse),
        clone: () => ({
          headers: new Map([["content-type", "text/plain"]]),
        }),
      });

      // First call
      await cactus.getSmiles();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should hit API again
      await cactus.getSmiles();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use global cache across instances", async () => {
      const cactus1 = new Cactus("aspirin");
      const cactus2 = new Cactus("aspirin");
      const mockResponse = "global cached response";

      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve(mockResponse),
        clone: () => ({
          headers: new Map([["content-type", "text/plain"]]),
        }),
      });

      // First instance calls API
      await cactus1.getSmiles();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second instance uses global cache
      await cactus2.getSmiles();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("should return cached result from getFile when available", async () => {
      const cactus = new Cactus("aspirin");
      const mockResponse = "cached file content";

      // First call to populate cache
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(mockResponse),
      });

      await cactus.getFile("sdf");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result = await cactus.getFile("sdf");
      expect(result).toBe("cached file content");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });
  });

  describe("XML format", () => {
    it("should append /xml to URL when XML format is enabled", async () => {
      const cactus = new Cactus("aspirin", true);
      const mockResponse = "XML response";

      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([["content-type", "text/xml"]]),
        text: () => Promise.resolve(mockResponse),
        clone: () => ({
          headers: new Map([["content-type", "text/xml"]]),
        }),
      });

      await cactus.getNames();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://cactus.nci.nih.gov/chemical/structure/aspirin/names/xml",
      );
    });

    it("should not append /xml to URL when XML format is disabled", async () => {
      const cactus = new Cactus("aspirin", false);
      const mockResponse = "text response";

      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve(mockResponse),
        clone: () => ({
          headers: new Map([["content-type", "text/plain"]]),
        }),
      });

      await cactus.getNames();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://cactus.nci.nih.gov/chemical/structure/aspirin/names",
      );
    });
  });

  describe("error handling", () => {
    it("should handle fetch errors gracefully", async () => {
      const cactus = new Cactus("aspirin");
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(cactus.getSmiles()).rejects.toThrow("Network error");
    });

    it("should handle non-string responses in assertIsStringResponse", async () => {
      const cactus = new Cactus("aspirin");
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([["content-type", "text/plain"]]),
        text: () => Promise.resolve(123), // Non-string response
        clone: () => ({
          headers: new Map([["content-type", "text/plain"]]),
        }),
      });

      await expect(cactus.getSmiles()).rejects.toThrow("Invalid response: 123");
    });
  });
});
