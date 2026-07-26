/**
 * @group Helpers
 * @groupDescription Advanced search-filter helpers shared by the search bar and the
 * results header (e.g. counting how many drawer filters deviate from their defaults).
 * @source
 */

/**
 * Count how many of the advanced search drawer's filters are set to a non-default
 * value: the selected-suppliers, country, shipping, and availability lists when
 * non-empty, plus the price range when either bound is set. A price min and max
 * count as a single filter (the price range), mirroring how the drawer groups
 * them. Boolean behavior toggles and the results limit are intentionally excluded
 * — this counts the discrete filter categories, matching the drawer's sections.
 * @category Helpers
 * @param params - The current advanced-search filter state (from the app context).
 * @returns The number of active filters; `0` when every filter is at its default.
 * @example
 * ```ts
 * countActiveSearchFilters({
 *   selectedSuppliers: ['Loudwolf'],
 *   searchFilters: { availability: [], country: [], shippingType: [] },
 *   userSettings: { priceMin: 10 },
 * }); // => 2 (suppliers + price range)
 * ```
 * @source
 */
export function countActiveSearchFilters(params: {
  selectedSuppliers?: readonly string[];
  searchFilters: Pick<SearchFilters, 'availability' | 'country' | 'shippingType'>;
  userSettings: Pick<UserSettings, 'priceMin' | 'priceMax'>;
}): number {
  const { selectedSuppliers = [], searchFilters, userSettings } = params;
  let count = 0;
  if (selectedSuppliers.length > 0) count += 1;
  if (searchFilters.country.length > 0) count += 1;
  if (searchFilters.shippingType.length > 0) count += 1;
  if (searchFilters.availability.length > 0) count += 1;
  if (userSettings.priceMin != null || userSettings.priceMax != null) count += 1;
  return count;
}
