import { CACHE } from "@/constants/common";
import { base64EncodeUtf8, md5sum, objectToQueryString } from "@/helpers/utils";
import { SupplierAmbeed } from "@/suppliers/SupplierAmbeed";
import { cstorage } from "@/utils/storage";
import { beforeEach, describe, expect, it, vi } from "vitest";
import sdsFixture from "../__fixtures__/ambeed/sds-response.json";

type AmbeedSignSupplier = SupplierAmbeed & {
  calculateSignSecret: () => string;
  getSign: (data: Record<string, unknown> | string, mode: 0 | 1) => string;
  makeProductPriceParams: (proid: string) => string;
};

type AmbeedSdsSupplier = {
  getSdsType: () => Promise<string>;
  getSdsUrls: (amNos: string[]) => Promise<Record<string, string>>;
};

const stubSettings = (settings: Record<string, unknown>) =>
  vi
    .spyOn(cstorage.local, "get")
    .mockResolvedValue({ [CACHE.USER_SETTINGS]: settings } as never);

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

  it("makeProductPriceParams includes a computed sign", () => {
    const encoded = supplier.makeProductPriceParams("3255116");

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
