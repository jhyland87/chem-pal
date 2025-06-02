/**
 * Helper function to load fixture data for supplier tests
 * @param supplier_name - The name of the supplier directory containing fixtures
 * @returns Object with methods to load fixture data
 */
export const fixtureData = (supplierName: string) => {
  const fixtureController = {
    nextFixture: undefined as string | undefined,
    httpGetJson: async (path: string) => {
      console.log("Called fixture httpGetJson");

      let fixtureName;

      if (fixtureController.nextFixture !== undefined) {
        // If there's a specific fixture set to be used next, use it and then reset the nextFixture
        fixtureName = fixtureController.nextFixture;
        fixtureController.nextFixture = undefined;
      } else {
        fixtureName = path.replace(/^\//, "").replaceAll("/", "__") + ".json";
      }

      const fixtueFile = `../${supplierName}/${fixtureName}`;
      const result = await import(fixtueFile);
      console.log("Fixture httpGetJson is returning file found at", fixtueFile);
      return result.default;
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
