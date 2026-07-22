import { ParameterType, type Application } from "typedoc";
import type { MemberSort, MergeMode, TermKind } from "./types.js";

/**
 * Plugin options after every fallback to a native TypeDoc option has been applied.
 * @category Taxonomy
 */
export interface ResolvedOptions {
  enabled: boolean;
  out: string;
  title: string;
  merge: MergeMode;
  kinds: TermKind[];
  categoryOrder: string[];
  groupOrder: string[];
  categorizeByGroup: boolean;
  memberSort: MemberSort;
  defaultCategory: string;
  includeDefault: boolean;
  excludeKindGroups: boolean;
  detailPages: boolean;
  sidebarLink: boolean;
}

/** Member sort strategies this plugin implements, in priority order. */
const SUPPORTED_MEMBER_SORTS: readonly MemberSort[] = ["alphabetical", "source-order", "kind"];

/**
 * Registers every `taxonomy*` option on the TypeDoc application.
 *
 * Must be called from `load()` — TypeDoc freezes the declaration set once plugins
 * have loaded. Option *values* must not be read here: `_bootstrap()` calls
 * `options.reset()` after plugins load, so config-file values are not yet applied.
 * @param app The TypeDoc application to register declarations on.
 * @example
 * ```ts
 * export function load(app: Application) {
 *   declareOptions(app);
 * }
 * ```
 * @source
 */
export function declareOptions(app: Application): void {
  app.options.addDeclaration({
    name: "taxonomyIndex",
    help: "[taxonomy-index] Emit the global category/group index pages.",
    type: ParameterType.Boolean,
    defaultValue: true,
  });
  app.options.addDeclaration({
    name: "taxonomyOut",
    help: "[taxonomy-index] Filename of the index page, relative to the output directory.",
    type: ParameterType.String,
    defaultValue: "taxonomy.html",
  });
  app.options.addDeclaration({
    name: "taxonomyTitle",
    help: "[taxonomy-index] Heading and sidebar label for the index page.",
    type: ParameterType.String,
    defaultValue: "Categories & Groups",
  });
  app.options.addDeclaration({
    name: "taxonomyMerge",
    help: "[taxonomy-index] How to combine terms sharing a title across different files.",
    type: ParameterType.Map,
    map: { byTitle: "byTitle", byTitleCaseInsensitive: "byTitleCaseInsensitive", none: "none" },
    defaultValue: "byTitle",
  });
  app.options.addDeclaration({
    name: "taxonomyKinds",
    help: '[taxonomy-index] Which taxonomies to index: "categories", "groups", or both.',
    type: ParameterType.Array,
    defaultValue: ["categories", "groups"],
  });
  app.options.addDeclaration({
    name: "taxonomyCategoryOrder",
    help: '[taxonomy-index] Category order; falls back to `categoryOrder`. Supports the "*" wildcard slot.',
    type: ParameterType.Array,
    defaultValue: [],
  });
  app.options.addDeclaration({
    name: "taxonomyGroupOrder",
    help: '[taxonomy-index] Group order; falls back to `groupOrder`. Supports the "*" wildcard slot.',
    type: ParameterType.Array,
    defaultValue: [],
  });
  app.options.addDeclaration({
    name: "taxonomyCategorizeByGroup",
    help: "[taxonomy-index] Read categories nested under groups; falls back to `categorizeByGroup`.",
    type: ParameterType.Boolean,
    defaultValue: true,
  });
  app.options.addDeclaration({
    name: "taxonomySort",
    help: "[taxonomy-index] Member ordering within a term; falls back to `sort`. One of alphabetical, source-order, kind.",
    type: ParameterType.Array,
    defaultValue: [],
  });
  app.options.addDeclaration({
    name: "taxonomyDefaultCategory",
    help: "[taxonomy-index] Title of the catch-all category; falls back to `defaultCategory`.",
    type: ParameterType.String,
    defaultValue: "Other",
  });
  app.options.addDeclaration({
    name: "taxonomyIncludeDefault",
    help: "[taxonomy-index] Include the catch-all category in the index.",
    type: ParameterType.Boolean,
    defaultValue: false,
  });
  app.options.addDeclaration({
    name: "taxonomyExcludeKindGroups",
    help: '[taxonomy-index] Drop groups TypeDoc generates from reflection kinds ("Functions", "Methods", …), keeping only hand-written @group tags.',
    type: ParameterType.Boolean,
    defaultValue: true,
  });
  app.options.addDeclaration({
    name: "taxonomyDetailPages",
    help: "[taxonomy-index] Emit a detail page per term listing all of its members.",
    type: ParameterType.Boolean,
    defaultValue: true,
  });
  app.options.addDeclaration({
    name: "taxonomySidebarLink",
    help: "[taxonomy-index] Add the index page to `sidebarLinks`.",
    type: ParameterType.Boolean,
    defaultValue: true,
  });
}

/**
 * Reads a plugin option that TypeDoc's `TypeDocOptionMap` does not know about.
 *
 * `Options.getValue` widens unknown names to `unknown`; these helpers narrow the
 * result without a type assertion, falling back to `fallback` if a reader ever
 * supplies an unexpected shape.
 * @param app The TypeDoc application.
 * @param name The declared option name.
 * @param fallback Value to use when the stored value is not a string.
 * @returns The option value, or `fallback`.
 * @example `readString(app, 'taxonomyOut', 'taxonomy.html') // => 'taxonomy.html'`
 * @source
 */
function readString(app: Application, name: string, fallback: string): string {
  const value: unknown = app.options.getValue(name);
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Reads a declared boolean plugin option.
 * @param app The TypeDoc application.
 * @param name The declared option name.
 * @param fallback Value to use when the stored value is not a boolean.
 * @returns The option value, or `fallback`.
 * @example `readBoolean(app, 'taxonomyIndex', true) // => true`
 * @source
 */
function readBoolean(app: Application, name: string, fallback: boolean): boolean {
  const value: unknown = app.options.getValue(name);
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Reads a declared string-array plugin option, dropping any non-string entries.
 * @param app The TypeDoc application.
 * @param name The declared option name.
 * @returns The string entries of the option value, or an empty array.
 * @example `readStringArray(app, 'taxonomyKinds') // => ['categories', 'groups']`
 * @source
 */
function readStringArray(app: Application, name: string): string[] {
  const value: unknown = app.options.getValue(name);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Narrows a raw `taxonomyMerge` value to a {@link MergeMode}.
 * @param value The raw option value.
 * @returns The matching merge mode, defaulting to `'byTitle'`.
 * @example `toMergeMode('none') // => 'none'`
 * @source
 */
function toMergeMode(value: unknown): MergeMode {
  if (value === "none" || value === "byTitleCaseInsensitive" || value === "byTitle") {
    return value;
  }
  return "byTitle";
}

/**
 * Picks the first supported member sort strategy from a `sort`-style array.
 *
 * TypeDoc's `sort` option accepts many strategies this plugin does not implement
 * (`enum-value-ascending`, `required-first`, …). Unsupported entries are skipped
 * rather than erroring, so `sort: ["source-order"]` and
 * `sort: ["required-first", "alphabetical"]` both resolve sensibly.
 * @param strategies Candidate strategy names, most significant first.
 * @returns The first recognised strategy, or `'alphabetical'`.
 * @example `pickMemberSort(['required-first', 'source-order']) // => 'source-order'`
 * @source
 */
function pickMemberSort(strategies: readonly string[]): MemberSort {
  for (const strategy of strategies) {
    const match = SUPPORTED_MEMBER_SORTS.find((supported) => supported === strategy);
    if (match) {
      return match;
    }
  }
  return "alphabetical";
}

/**
 * Resolves every plugin option, falling back to the equivalent native TypeDoc
 * option whenever the plugin-specific one was not explicitly set.
 *
 * Call this at `RendererEvent.BEGIN` or later — option values read during `load()`
 * are discarded by TypeDoc's post-plugin `options.reset()`.
 * @param app The TypeDoc application.
 * @returns The fully resolved option set.
 * @example
 * ```ts
 * // typedoc.json: { "categoryOrder": ["Utils", "*"], "sort": ["source-order"] }
 * resolveOptions(app).categoryOrder // => ['Utils', '*']
 * resolveOptions(app).memberSort    // => 'source-order'
 * ```
 * @source
 */
export function resolveOptions(app: Application): ResolvedOptions {
  const taxonomySort = readStringArray(app, "taxonomySort");
  const nativeSort = app.options.getValue("sort");
  const taxonomyCategoryOrder = readStringArray(app, "taxonomyCategoryOrder");
  const taxonomyGroupOrder = readStringArray(app, "taxonomyGroupOrder");
  const kinds = readStringArray(app, "taxonomyKinds");

  return {
    enabled: readBoolean(app, "taxonomyIndex", true),
    out: readString(app, "taxonomyOut", "taxonomy.html"),
    title: readString(app, "taxonomyTitle", "Categories & Groups"),
    merge: toMergeMode(app.options.getValue("taxonomyMerge")),
    kinds: [
      ...(kinds.includes("categories") ? ["category" as const] : []),
      ...(kinds.includes("groups") ? ["group" as const] : []),
    ],
    categoryOrder:
      taxonomyCategoryOrder.length > 0
        ? taxonomyCategoryOrder
        : app.options.getValue("categoryOrder"),
    groupOrder:
      taxonomyGroupOrder.length > 0 ? taxonomyGroupOrder : app.options.getValue("groupOrder"),
    categorizeByGroup: app.options.isSet("taxonomyCategorizeByGroup")
      ? readBoolean(app, "taxonomyCategorizeByGroup", true)
      : app.options.getValue("categorizeByGroup"),
    memberSort: pickMemberSort(taxonomySort.length > 0 ? taxonomySort : nativeSort),
    defaultCategory: app.options.isSet("taxonomyDefaultCategory")
      ? readString(app, "taxonomyDefaultCategory", "Other")
      : app.options.getValue("defaultCategory"),
    includeDefault: readBoolean(app, "taxonomyIncludeDefault", false),
    excludeKindGroups: readBoolean(app, "taxonomyExcludeKindGroups", true),
    detailPages: readBoolean(app, "taxonomyDetailPages", true),
    sidebarLink: readBoolean(app, "taxonomySidebarLink", true),
  };
}
