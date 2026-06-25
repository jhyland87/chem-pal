import { base64EncodeUtf8, md5sum, objectToQueryString } from "@/helpers/utils";
import { SupplierAmbeed } from "@/suppliers/SupplierAmbeed";
import { describe, expect, it } from "vitest";

type AmbeedSignSupplier = SupplierAmbeed & {
  calculateSignSecret: () => string;
  getSign: (data: Record<string, unknown> | string, mode: 0 | 1) => string;
  makeProductPriceParams: (proid: string) => string;
};

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
