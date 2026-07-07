import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the chemistry helper modules so importing debugConsole has no real
// side effects and the exposed API surface is deterministic.
vi.mock("@/helpers/cas", () => ({
  findCAS: vi.fn(),
  getCASByName: vi.fn(),
  getIUPACName: vi.fn(),
  getNamesByCAS: vi.fn(),
  isCAS: vi.fn(),
}));
vi.mock("@/helpers/pubchem", () => ({
  executeSDQSearch: vi.fn(),
  getCompoundNameFromAlias: vi.fn(),
  getRankedNamesByName: vi.fn(),
  isSimpleName: vi.fn(),
  suggestAlternativeSearch: vi.fn(async () => ["result"]),
}));
vi.mock("@/helpers/smiles", () => ({
  extractSmiles: vi.fn(),
  isProbablyValidSmiles: vi.fn(),
  looksLikeSmiles: vi.fn(),
  parseStructurePrefix: vi.fn(),
  resolveQueryForSearch: vi.fn(),
  resolveSmiles: vi.fn(),
}));
vi.mock("@/utils/Cactus", () => ({ Cactus: class {} }));

import { suggestAlternativeSearch } from "@/helpers/pubchem";
import { exposeDebugApi } from "@/utils/debugConsole";

describe("exposeDebugApi", () => {
  beforeEach(() => {
    delete (window as { chempal?: unknown }).chempal;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (window as { chempal?: unknown }).chempal;
    vi.restoreAllMocks();
  });

  it("attaches the chempal helper object to window", () => {
    exposeDebugApi();
    expect(window.chempal).toBeDefined();
    expect(typeof window.chempal?.resolveSmiles).toBe("function");
    expect(typeof window.chempal?.help).toBe("function");
    expect(window.chempal?.Cactus).toBeDefined();
  });

  it("exposes the IndexedDB inspection helpers", () => {
    exposeDebugApi();
    expect(typeof window.chempal?.getProductById).toBe("function");
    expect(typeof window.chempal?.getProductPriceHistory).toBe("function");
    expect(typeof window.chempal?.getProductCache).toBe("function");
    expect(typeof window.chempal?.getQueryCache).toBe("function");
    expect(typeof window.chempal?.getSearchResults).toBe("function");
    expect(typeof window.chempal?.getSearchHistory).toBe("function");
    expect(typeof window.chempal?.getExcludedProducts).toBe("function");
  });

  it("logs a readiness banner", () => {
    exposeDebugApi();
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining("ChemPal debug helpers ready"),
      expect.any(String),
    );
  });

  it("help() prints usage to the console", () => {
    exposeDebugApi();
    (console.info as ReturnType<typeof vi.fn>).mockClear();
    window.chempal?.help();
    expect(console.info).toHaveBeenCalledTimes(1);
    const [message] = (console.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(message).toContain("ChemPal debug helpers");
    expect(message).toContain("SMILES:");
  });

  it("suggestAlternativeSearch wrapper lowercases and Set-wraps the excluded array", async () => {
    exposeDebugApi();
    await window.chempal?.suggestAlternativeSearch("Aspirin", ["ASPIRIN", "Ibuprofen"]);
    expect(suggestAlternativeSearch).toHaveBeenCalledTimes(1);
    const [query, excluded] = (suggestAlternativeSearch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(query).toBe("Aspirin");
    expect(excluded).toBeInstanceOf(Set);
    expect(excluded.has("aspirin")).toBe(true);
    expect(excluded.has("ibuprofen")).toBe(true);
  });

  it("suggestAlternativeSearch wrapper defaults excluded to an empty Set", async () => {
    exposeDebugApi();
    await window.chempal?.suggestAlternativeSearch("aspirin");
    const [, excluded] = (suggestAlternativeSearch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(excluded).toBeInstanceOf(Set);
    expect(excluded.size).toBe(0);
  });
});
