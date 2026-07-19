import { CACHE } from "@/constants/common";
import { base64EncodeUtf8, md5sum, objectToQueryString } from "@/helpers/utils";
import { SupplierAmbeed } from "@/suppliers/SupplierAmbeed";
import { cstorage } from "@/utils/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sdsFixture from "../__fixtures__/ambeed/sds-response.json";

type AmbeedSignSupplier = SupplierAmbeed & {
  calculateSignSecret: () => string;
  getSign: (data: Record<string, unknown> | string, mode: 0 | 1) => string;
  makeSignedParams: (
    signedFields: Record<string, unknown>,
    extraFields?: Record<string, unknown>,
  ) => string;
};

type AmbeedSdsSupplier = {
  getSdsType: () => Promise<string>;
  getSdsUrls: (amNos: string[]) => Promise<Record<string, string>>;
};

type AmbeedKeySupplier = {
  getUniqueProductKey: (data: { p_id?: string; p_am?: string }) => string;
};

const stubSettings = (settings: Record<string, unknown>) =>
  vi.spyOn(cstorage.local, "get").mockResolvedValue({ [CACHE.USER_SETTINGS]: settings } as never);

describe("SupplierAmbeed getUniqueProductKey", () => {
  const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedKeySupplier;

  it("keys on p_am (the per-listing article id), not p_id (the shared compound)", () => {
    expect(supplier.getUniqueProductKey({ p_id: "P000728385", p_am: "A112492" })).toBe("A112492");
  });

  it("gives distinct keys to two brand listings of the same compound", () => {
    // Real Ambeed data: one p_id (Hyaluronic acid) listed under multiple p_am/brands.
    const a = supplier.getUniqueProductKey({ p_id: "P000235130", p_am: "A420964" });
    const b = supplier.getUniqueProductKey({ p_id: "P000235130", p_am: "A1463898" });
    expect(a).not.toBe(b);
  });

  it("falls back to p_id when p_am is missing", () => {
    expect(supplier.getUniqueProductKey({ p_id: "P000728385" })).toBe("P000728385");
  });
});

describe("SupplierAmbeed signing", () => {
  const supplier = new SupplierAmbeed("test", 1) as AmbeedSignSupplier;

  it("calculateSignSecret returns the expected constant secret", () => {
    expect(supplier.calculateSignSecret()).toBe("6587ab544f254fe4a5f64a41531b95b2");
  });

  it("getSign mode 1 base64-encodes the md5 hex of the signed query string", () => {
    const payload = {
      timestamp: "abc123",
      proid: "3255116",
    };
    const query = `${objectToQueryString(payload)}&sign=${supplier.calculateSignSecret()}`;

    expect(supplier.getSign(payload, 1)).toBe(base64EncodeUtf8(md5sum(query)));
  });

  it("getSign mode 0 returns md5 hex of string input plus secret", () => {
    const payload = {
      timestamp: "abc123",
      proid: "3255116",
    };
    const json = JSON.stringify(payload);

    expect(supplier.getSign(json, 0)).toBe(md5sum(json + supplier.calculateSignSecret()));
  });

  it("makeSignedParams (product_price) signs timestamp and proid", () => {
    const encoded = supplier.makeSignedParams({ proid: "3255116" });

    const decoded = JSON.parse(atob(encoded)) as {
      timestamp: number;
      proid: string;
      _: string;
      __: string[];
    };

    expect(decoded.proid).toBe("3255116");
    expect(decoded.__).toEqual(["timestamp", "proid"]);
    expect(decoded._).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(typeof decoded.timestamp).toBe("number");
  });

  it("makeSignedParams (product_stock) signs bd and carries proid unsigned", () => {
    const encoded = supplier.makeSignedParams({ bd: "BD21445" }, { proid: "P000325570" });

    const decoded = JSON.parse(atob(encoded)) as {
      timestamp: number;
      bd: string;
      proid: string;
      _: string;
      __: string[];
    };

    expect(decoded.bd).toBe("BD21445");
    expect(decoded.proid).toBe("P000325570");
    // Only the signed fields are listed in __; proid rides along unsigned.
    expect(decoded.__).toEqual(["timestamp", "bd"]);
    expect(decoded._).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});

describe("SupplierAmbeed SDS", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("getSdsType", () => {
    it("uses the country-specific type for non-European users", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      stubSettings({ location: "US", language: "en-US" });
      expect(await supplier.getSdsType()).toBe("am");
      stubSettings({ location: "CN", language: "zh-CN" });
      expect(await supplier.getSdsType()).toBe("am-cn");
    });

    it("uses the language-matched European type for European users", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      stubSettings({ location: "DE", language: "de-DE" });
      expect(await supplier.getSdsType()).toBe("amgm-de-de");
      stubSettings({ location: "FR", language: "fr-FR" });
      expect(await supplier.getSdsType()).toBe("amgm-sds-fr-fr");
      // Danish language "da" maps to the DK suffix.
      stubSettings({ location: "DK", language: "da-DK" });
      expect(await supplier.getSdsType()).toBe("amgm-sds-da-dk");
    });

    it("special-cases GB and falls back to English Europe / am when unmatched", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      stubSettings({ location: "GB", language: "en-GB" });
      expect(await supplier.getSdsType()).toBe("amgm-europe-uk");
      // European country with an unsupported language → generic English Europe.
      stubSettings({ location: "GR", language: "el-GR" });
      expect(await supplier.getSdsType()).toBe("amgm-europe");
      // Non-European, unknown country → English (am).
      stubSettings({ location: "JP", language: "ja-JP" });
      expect(await supplier.getSdsType()).toBe("am");
    });
  });

  describe("getSdsUrls", () => {
    it("maps each product id to its preferred-type SDS url in one request", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      vi.spyOn(supplier as never, "getSdsType").mockResolvedValue("am-de-de" as never);
      const post = vi
        .spyOn(supplier as never, "httpPostJson")
        .mockResolvedValue(sdsFixture as never);

      const urls = await supplier.getSdsUrls(["A491321", "A1159477"]);

      expect(post).toHaveBeenCalledTimes(1); // single batch request
      expect(urls["A491321"]).toBe(
        "https://us-file.ambeed.com/prodsds/amb-sds-de-europe/492/SDS-A491321.pdf",
      );
      expect(urls["A1159477"]).toBe(
        "https://us-file.ambeed.com/prodsds/amb-sds-de-europe/1160/SDS-A1159477.pdf",
      );
    });

    it("falls back to the am (English) url when the preferred type is unavailable", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      // "amgm-de-de" isn't present in the fixture, so it should fall back to "am".
      vi.spyOn(supplier as never, "getSdsType").mockResolvedValue("amgm-de-de" as never);
      vi.spyOn(supplier as never, "httpPostJson").mockResolvedValue(sdsFixture as never);

      const urls = await supplier.getSdsUrls(["A491321"]);

      expect(urls["A491321"]).toBe(
        "https://us-file.ambeed.com/prodsds/amb-sds-en/492/SDS-A491321.pdf",
      );
    });

    it("returns {} and makes no request for an empty id list", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      const post = vi.spyOn(supplier as never, "httpPostJson");

      expect(await supplier.getSdsUrls([])).toEqual({});
      expect(post).not.toHaveBeenCalled();
    });

    it("returns {} when the response fails the typeguard", async () => {
      const supplier = new SupplierAmbeed("test", 1) as unknown as AmbeedSdsSupplier;
      vi.spyOn(supplier as never, "getSdsType").mockResolvedValue("am" as never);
      vi.spyOn(supplier as never, "httpPostJson").mockResolvedValue({ nope: true } as never);

      expect(await supplier.getSdsUrls(["A491321"])).toEqual({});
    });
  });
});

type AmbeedFilterSupplier = SupplierAmbeed & {
  filterByStructuredQuery: (
    items: AmbeedProductListResponseResultItem[],
  ) => AmbeedProductListResponseResultItem[];
};

const ambeedItem = (
  fields: Partial<AmbeedProductListResponseResultItem>,
): AmbeedProductListResponseResultItem => fields as AmbeedProductListResponseResultItem;

const ethanol = ambeedItem({
  p_proper_name3: "Ethanol",
  p_name_en: "ethanol",
  p_cas: "64-17-5",
  p_moleform: "C<sub>2</sub>H<sub>6</sub>O",
  p_inchikey: "LFQSCWFLJHTTHZ-UHFFFAOYSA-N",
});
const malPeg = ambeedItem({
  p_proper_name3: "Mal-PEG4-AcCOOH",
  p_name_en: "14-(2,5-Dioxo-2,5-dihydro-1H-pyrrol-1-yl)-3,6,9,12-tetraoxatetradecan-1-oic acid",
  p_cas: "1286754-10-6",
  p_moleform: "C<sub>14</sub>H<sub>21</sub>NO<sub>8</sub>",
  p_inchikey: "IBIJGYJSVGSTQS-UHFFFAOYSA-N",
});
const niccolate = ambeedItem({
  p_proper_name3: "",
  p_name_en: "Tetrabutylphosphonium bis(1,2-benzenedithiolato)niccolate(III)",
  p_cas: "112527-20-5",
  p_moleform: "C<sub>28</sub>H<sub>48</sub>NiPS<sub>4</sub>",
  p_inchikey: "",
});
const items = [ethanol, malPeg, niccolate];

const titlesOf = (results: AmbeedProductListResponseResultItem[]): string[] =>
  results.map((r) => r.p_proper_name3 || r.p_name_en);

describe("SupplierAmbeed filterByStructuredQuery", () => {
  it("keeps only the CAS-matching product for a CAS query", () => {
    const supplier = new SupplierAmbeed("1286754-10-6", 15) as AmbeedFilterSupplier;
    expect(supplier.filterByStructuredQuery(items)).toEqual([malPeg]);
  });

  it("keeps only the formula-matching product for a formula query", () => {
    const supplier = new SupplierAmbeed("C14H21NO8", 15) as AmbeedFilterSupplier;
    expect(supplier.filterByStructuredQuery(items)).toEqual([malPeg]);
  });

  it("resolves a SMILES query via the injected structure map and keeps only that compound", () => {
    const supplier = new SupplierAmbeed("CCO", 15) as AmbeedFilterSupplier;
    supplier.setResolvedStructures(new Map([["CCO", { name: "ethanol", cas: ["64-17-5"] }]]));

    expect(supplier.filterByStructuredQuery(items)).toEqual([ethanol]);
  });

  it("honors an advanced CAS-OR-formula query via the augmented target", () => {
    const supplier = new SupplierAmbeed("64-17-5 OR C14H21NO8", 15) as AmbeedFilterSupplier;

    expect(titlesOf(supplier.filterByStructuredQuery(items)).sort()).toEqual(
      ["Ethanol", "Mal-PEG4-AcCOOH"].sort(),
    );
  });

  it("degrades gracefully (no throw) when a SMILES term has no resolved structure", () => {
    const supplier = new SupplierAmbeed("CCO", 15) as AmbeedFilterSupplier;
    // No setResolvedStructures — the SMILES leaf falls back to raw-term matching.
    const result = supplier.filterByStructuredQuery(items);

    // Ethanol's name contains no "cco", so the raw fallback never keeps it.
    expect(result).not.toContain(ethanol);
  });

  it.skip("falls back to fuzzy name filtering for a plain-string query (all results retained)", () => {
    const supplier = new SupplierAmbeed("ethanol", 15) as AmbeedFilterSupplier;
    expect(supplier.filterByStructuredQuery(items)).toHaveLength(items.length);
  });
});
