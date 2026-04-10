/**
 * Helper function to load fixture data for supplier tests
 * @param supplier_name - The name of the supplier directory containing fixtures
 * @returns Object with methods to load fixture data
 */
export const fixtureData = (supplierName: string) => {
  const fixtureController = {
    nextFixture: undefined as string | undefined,
    httpGetJson: async (path: string) => {
      console.log("Called fixture httpGetJson", { path });

      if (fixtureController.nextFixture !== undefined) {
        // If there's a specific fixture set to be used next, use it and then reset the nextFixture
        const fixtureName = fixtureController.nextFixture;
        fixtureController.nextFixture = undefined;
        const fixtureFile = `../${supplierName}/${fixtureName}`;
        const result = await import(fixtureFile);
        return result.default;
      }

      // Normalize the path: strip leading and trailing slashes.
      const normalized = path.replace(/^\//, "").replace(/\/$/, "");
      // Build candidate fixture file names in order of preference. Different suppliers
      // (and different code paths within a supplier) may produce paths with or without
      // a leading locale segment like `en/`, so try both forms.
      const candidates = new Set<string>();
      candidates.add(normalized.replaceAll("/", "__") + ".json");
      const withoutLocale = normalized.replace(/^[a-z]{2}\//, "");
      if (withoutLocale !== normalized) {
        candidates.add(withoutLocale.replaceAll("/", "__") + ".json");
      }

      let lastError: unknown;
      for (const fixtureName of candidates) {
        try {
          const fixtureFile = `../${supplierName}/${fixtureName}`;
          const result = await import(fixtureFile);
          console.log("Fixture httpGetJson is returning file found at", fixtureFile);
          return result.default;
        } catch (err) {
          lastError = err;
        }
      }
      console.error("No fixture found for path", { path, candidates: [...candidates] });
      throw lastError;
    },
    search: (query: string) => {
      return async (fixtureName?: string) => {
        try {
          const fixtureFile = `../${supplierName}/search-${query}-${fixtureName}.json`;
          console.log("looking for fixture", fixtureFile);
          const result = await import(fixtureFile);
          return result.default;
        } catch (error) {
          console.error("Error in search", error);
          return undefined;
        }
      };
    },
  };

  return fixtureController;
};
