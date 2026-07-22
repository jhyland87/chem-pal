import type { Page } from "@playwright/test";

/** Options controlling how many synthetic points each series is padded to. */
interface SeedOptions {
  /** Minimum total points per series (inclusive). Defaults to 2. */
  minPoints?: number;
  /** Maximum total points per series (inclusive). Defaults to 4. */
  maxPoints?: number;
  /** Approx. spacing between synthetic points, in days. Defaults to 9. */
  spacingDays?: number;
  /** Max fractional swing of a synthetic price vs the real one. Defaults to 0.18. */
  swing?: number;
}

/** What the seeding pass did, for logging. */
interface SeedResult {
  /** Number of series that were enriched. */
  series: number;
  /** Total points across all enriched series after seeding. */
  points: number;
}

/**
 * Enrich the extension's `price_history` store so each series has 2–4 points and
 * renders a sparkline/trend in the product detail panel. Must run AFTER a search
 * has completed: the app writes one real point per series (keyed by the product's
 * md5 identity), and this pass reads those series back and prepends backdated,
 * price-varied synthetic points — so it works for whatever products the current
 * mock data produces, with no hard-coded ids. Idempotent: series that already
 * have ≥2 points are left alone. The real (latest) point is always kept last so
 * it stays consistent with the price shown in the results table.
 * @param page - A page on the extension origin with the `chempal` IndexedDB.
 * @param options - Point-count and price-variation tuning.
 * @returns Counts of series enriched and total points written.
 * @example
 * ```ts
 * await expect(backdrop).toBeHidden();
 * const seeded = await seedPriceHistoryFromResults(page);
 * // => { series: 45, points: 132 }
 * ```
 * @source
 */
export async function seedPriceHistoryFromResults(
  page: Page,
  options: SeedOptions = {},
): Promise<SeedResult> {
  const config = {
    minPoints: options.minPoints ?? 2,
    maxPoints: options.maxPoints ?? 4,
    spacingDays: options.spacingDays ?? 9,
    swing: options.swing ?? 0.18,
  };

  return page.evaluate((cfg) => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Deterministic per-series RNG so re-runs produce the same demo history.
    function seedFrom(str: string): number {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }
    function mulberry32(seed: number): () => number {
      let a = seed;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const round2 = (n: number): number => Number(n.toFixed(2));

    return new Promise<{ series: number; points: number }>((resolve, reject) => {
      const open = indexedDB.open("chempal");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("price_history")) {
          db.close();
          resolve({ series: 0, points: 0 });
          return;
        }
        const tx = db.transaction("price_history", "readwrite");
        const store = tx.objectStore("price_history");
        const getAll = store.getAll();
        getAll.onerror = () => reject(getAll.error);
        getAll.onsuccess = () => {
          const entries = getAll.result ?? [];
          let seededSeries = 0;
          let totalPoints = 0;

          for (const entry of entries) {
            const points = Array.isArray(entry.points) ? [...entry.points] : [];
            points.sort((a, b) => a.t - b.t);
            if (points.length >= cfg.minPoints) {
              // Already has enough history — leave it untouched.
              totalPoints += points.length;
              continue;
            }

            const rng = mulberry32(seedFrom(String(entry.id)));
            const target = cfg.minPoints + Math.floor(rng() * (cfg.maxPoints - cfg.minPoints + 1));
            const anchor = points[0] ?? { t: Date.now(), usd: 10 };
            const need = Math.max(0, target - points.length);

            // Build `need` older points, walking backwards from the anchor.
            const synthetic: { t: number; usd: number }[] = [];
            let prevUsd = anchor.usd;
            for (let i = 0; i < need; i++) {
              const t = anchor.t - (i + 1) * cfg.spacingDays * DAY_MS;
              const factor = 1 + (rng() - 0.5) * 2 * cfg.swing;
              let usd = round2(Math.max(0.01, anchor.usd * factor));
              // Keep adjacent points distinct so a trend actually renders.
              if (usd === prevUsd) usd = round2(usd + (rng() < 0.5 ? -0.05 : 0.05));
              prevUsd = usd;
              synthetic.push({ t, usd });
            }
            synthetic.sort((a, b) => a.t - b.t);

            const merged = [...synthetic, ...points];
            store.put({ ...entry, points: merged, updatedAt: anchor.t });
            seededSeries += 1;
            totalPoints += merged.length;
          }

          tx.oncomplete = () => {
            db.close();
            resolve({ series: seededSeries, points: totalPoints });
          };
          tx.onerror = () => reject(tx.error);
        };
      };
    });
  }, config);
}
