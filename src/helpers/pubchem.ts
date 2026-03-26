/**
 * SDQ (Structure Data Query) agent from PubChem API
 * @see https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi
 * @see https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest#section=Operation
 *
 * SDQ types are declared globally in types/pubchem.d.ts
 * @source
 */

/**
 * Type guard to assert that data is a valid SDQResponse
 * @param data - The data to validate
 * @source
 */
function assertIsSDQResponse(data: unknown): asserts data is SDQResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("data is not an object");
  }
  if (!("SDQOutputSet" in data) || typeof data.SDQOutputSet !== "object") {
    throw new Error("data.SDQOutputSet is not an object");
  }
}

/**
 * Type guard to assert that data is a valid SDQQueryWhere
 * @param data - The data to validate
 * @source
 */
function assertIsSDQWhere(where: unknown): asserts where is SDQWhere {
  if (typeof where !== "object" || where === null) {
    throw new Error("where is not an object");
  }
}

/**
 * Query the SDQ agent for a compound name from a synonym.
 * @param cmpdsynonym - The synonym to query the SDQ agent for.
 * @returns The compound name from the SDQ agent.
 * @example
 * ```typescript
 * const cmpd = await executeSDQSearch({
 *   where: { cmpdsynonym: "2-Acetoxybenzenecarboxylic acid" },
 *   select: ["cid", "cmpdname"],
 *   limit: 1,
 * });
 * console.log(cmpd);
 * // Outputs: Aspirin
 * ```
 * @source
 */
export async function executeSDQSearch({
  where,
  select = "*",
  limit = 10,
}: SDQAgentQuery): Promise<SDQResultItem[] | undefined> {
  try {
    assertIsSDQWhere(where);

    if (select !== "*") {
      if (Array.isArray(select)) {
        select = select.join(",");
      } else {
        select = "*";
      }
    }

    const pubchemQuery = {
      select,
      limit,
      collection: "compound",
      order: ["cid,asc"],
      start: 1,
      where: { ands: [where] },
    };

    console.debug("pubchemQuery", pubchemQuery);
    const queryURLString = JSON.stringify(pubchemQuery);

    const response = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/sdq/sdqagent.cgi?infmt=json&outfmt=json&query=${queryURLString}`,
    );
    const data = await response.json();
    assertIsSDQResponse(data);
    const outputSets = data.SDQOutputSet;
    if (!outputSets || outputSets.length === 0) {
      return undefined;
    }

    if (outputSets[0].status.code !== 0) {
      console.warn(
        `SDQ agent returned a non-zero status code: ${outputSets[0].status.code}`,
        { where, select, limit },
        { response: data },
      );
      return undefined;
    }

    if (outputSets[0].totalCount === 0 || outputSets[0]?.rows?.length === 0) {
      console.debug(`SDQ agent returned no results`, { where, select, limit }, { response: data });
      return undefined;
    }

    return outputSets[0].rows;
  } catch (error) {
    console.error("Error querying SDQ agent:", error);
  }
}

/**
 * Get the compound name from a synonym.
 * @param cmpdsynonym - The synonym to get the compound name from.
 * @returns The compound name from the synonym.
 * @example
 * ```typescript
 * const cmpd = await getCompoundNameFromAlias("2-Acetoxybenzenecarboxylic acid");
 * console.log(cmpd);
 * // Outputs: Aspirin
 * ```
 * @source
 */
export async function getCompoundNameFromAlias(cmpdsynonym: string): Promise<string | undefined> {
  const searchResult = await executeSDQSearch({
    where: { cmpdsynonym },
    select: ["cid", "cmpdname", "iupacname"],
    limit: 1,
  });

  if (!searchResult) {
    return undefined;
  }

  return searchResult[0].cmpdname;
}
