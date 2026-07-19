/**
 * schema-org.ts
 *
 * Extract, normalize, and query schema.org JSON-LD from a page.
 *
 * Design notes (from https://schema.org/docs/datamodel.html):
 *  - `@context` has several valid forms: "https://schema.org", the same with a
 *    trailing slash, the http:// variants, an array, or an object whose values
 *    point at schema.org. All are accepted.
 *  - `@type` may be a single string OR an array of strings (an item can be several
 *    types at once), so we never assume a scalar.
 *  - A single `<script>` may hold one node, an array of nodes, or an `@graph` wrapper.
 *  - Any property may be single- or multi-valued; use `toArray` when you don't
 *    care which.
 */

/**
 * The generic JSON types {@link JsonPrimitive}, {@link JsonValue}, and
 * {@link JsonObject} are declared globally in `src/types/common.d.ts`.
 */

/**
 * A single schema.org entity — a {@link JsonObject} that normally carries an
 * `@type` (and, at the top level, an `@context`). Every Thing in schema.org is
 * modelled this way.
 *
 * @category Helpers
 * @example
 * ```ts
 * const node: SchemaNode = {
 *   '@context': 'https://schema.org',
 *   '@type': 'Product',
 *   name: 'POTASSIUM HYDROXIDE 90%, kg',
 * };
 * ```
 *
 * @source
 */
export type SchemaNode = JsonObject;

/** Matches http(s)://schema.org with an optional trailing slash, case-insensitive. */
const SCHEMA_CONTEXT_RE = /^https?:\/\/schema\.org\/?$/i;

/** Keys stripped from the body when producing the type-keyed nested view. */
const STRUCTURAL_KEYS = new Set(["@context", "@type"]);

function isPlainObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Matches a schema.org enumeration URL — the host followed by exactly one
 * identifier segment, e.g. https://schema.org/InStock. Multi-segment paths,
 * query strings, and the bare context URL do not match.
 */
const SCHEMA_ENUM_RE = /^https?:\/\/schema\.org\/([A-Za-z][A-Za-z0-9_]*)$/;

/**
 * Strip a leading `http(s)://schema.org/` from a schema.org enumeration value,
 * leaving the bare member name (e.g. `"https://schema.org/InStock"` becomes
 * `"InStock"`). Only a single identifier segment is stripped, so real URLs, the
 * `@context`, `@id` links, and off-site URLs are returned unchanged.
 *
 * @category Helpers
 * @param value - A string that may be a schema.org enumeration URL.
 * @returns The bare member name when it matches, otherwise the original string.
 *
 * @example
 * ```ts
 * stripSchemaEnumPrefix('https://schema.org/PreOrder');     // 'PreOrder'
 * stripSchemaEnumPrefix('https://schema.org/NewCondition'); // 'NewCondition'
 * stripSchemaEnumPrefix('https://schema.org');              // unchanged (context)
 * stripSchemaEnumPrefix('https://carolina.com/p/888770');   // unchanged (off-site)
 * ```
 *
 * @source
 */
export function stripSchemaEnumPrefix(value: string): string {
  const match = SCHEMA_ENUM_RE.exec(value);
  return match ? match[1] : value;
}

/**
 * Deep-copy a value, applying `stripSchemaEnumPrefix` to every string. `@context`
 * is preserved verbatim so schema.org context detection still works downstream.
 */
function normalizeValue(value: JsonValue): JsonValue {
  if (typeof value === "string") return stripSchemaEnumPrefix(value);
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (isPlainObject(value)) {
    const out: JsonObject = {};
    for (const key of Object.keys(value)) {
      out[key] = key === "@context" ? value[key] : normalizeValue(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * Normalize a possibly-single, possibly-repeated property value to an array.
 * schema.org allows any property to carry one value or many, so wrapping is the
 * safe way to iterate (e.g. `image` may be a single URL or a list).
 *
 * @category Helpers
 * @typeParam T - Element type of the value(s).
 * @param value - A single value, an array of values, `undefined`, or `null`.
 * @returns An array: `[]` for nullish input, the input unchanged if already an
 *   array, otherwise a one-element array.
 *
 * @example
 * ```ts
 * toArray('a.jpg');            // ['a.jpg']
 * toArray(['a.jpg', 'b.jpg']); // ['a.jpg', 'b.jpg']
 * toArray(undefined);          // []
 * ```
 *
 * @source
 */
export function toArray<T = JsonValue>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Read a node's `@type` as a string array. An item may declare several types at
 * once (schema.org uses multiple inheritance — something can be both a `Book`
 * and a `Product`), and `@type` may be absent, so this always returns an array.
 *
 * @category Helpers
 * @param node - The schema.org node to inspect.
 * @returns The declared types as strings; `[]` when `@type` is missing.
 *
 * @example
 * ```ts
 * typeList({ '@type': 'Product' });            // ['Product']
 * typeList({ '@type': ['Book', 'Product'] });  // ['Book', 'Product']
 * typeList({ name: 'untyped' });               // []
 * ```
 *
 * @source
 */
export function typeList(node: JsonObject): string[] {
  return toArray(node["@type"]).filter((t): t is string => typeof t === "string");
}

/**
 * Decide whether a JSON-LD `@context` denotes schema.org, tolerating every form
 * seen in the wild: `http`/`https`, an optional trailing slash, an array of
 * contexts, or an object whose values point at schema.org (e.g. an `@vocab`).
 *
 * @category Helpers
 * @param ctx - The value of a node's `@context` (any JSON value or `undefined`).
 * @returns `true` if the context refers to schema.org, otherwise `false`.
 *
 * @example
 * ```ts
 * isSchemaContext('https://schema.org');                 // true
 * isSchemaContext('https://schema.org/');                // true (trailing slash)
 * isSchemaContext({ '@vocab': 'https://schema.org/' });  // true
 * isSchemaContext('https://example.com');                // false
 * ```
 *
 * @source
 */
export function isSchemaContext(ctx: JsonValue | undefined): boolean {
  if (typeof ctx === "string") return SCHEMA_CONTEXT_RE.test(ctx);
  if (Array.isArray(ctx)) return ctx.some(isSchemaContext);
  if (isPlainObject(ctx)) {
    // e.g. { "@vocab": "https://schema.org/" } or a prefix map.
    return Object.values(ctx).some((v) => typeof v === "string" && SCHEMA_CONTEXT_RE.test(v));
  }
  return false;
}

/** Read and JSON.parse every ld+json block, tolerating malformed ones. */
function parseScripts(root: ParentNode): unknown[] {
  const scripts = Array.from(root.querySelectorAll('script[type="application/ld+json"]'));
  const parsed: unknown[] = [];
  for (const el of scripts) {
    // textContent (not innerText) works outside a rendered DOM, e.g. jsdom.
    const raw = (el.textContent ?? "")
      .trim()
      .replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "");
    if (!raw) continue;
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      // Skip invalid JSON-LD rather than failing the whole page.
    }
  }
  return parsed;
}

/** Flatten one parsed block into top-level nodes, unwrapping `@graph` and arrays. */
function collectNodes(parsed: unknown): SchemaNode[] {
  if (Array.isArray(parsed)) return parsed.flatMap(collectNodes);
  if (!isPlainObject(parsed)) return [];

  const ctx = parsed["@context"];
  if (Array.isArray(parsed["@graph"])) {
    // Context lives on the wrapper; inherit it into graph members that lack one.
    return parsed["@graph"]
      .filter(isPlainObject)
      .map((node) =>
        node["@context"] === undefined && ctx !== undefined ? { "@context": ctx, ...node } : node,
      );
  }
  return [parsed];
}

// --- type-keyed nested view -------------------------------------------------

function nestBody(node: JsonObject): JsonObject {
  const body: JsonObject = {};
  for (const key of Object.keys(node)) {
    if (STRUCTURAL_KEYS.has(key)) continue; // @id and identifier are kept
    body[key] = nestValue(node[key]);
  }
  return body;
}

function nestObject(node: JsonObject): JsonValue {
  const types = typeList(node);
  const body = nestBody(node);
  if (types.length === 1) return { [types[0]]: body };
  // Preserve multi-type nodes rather than picking one arbitrarily.
  if (types.length > 1) return { "@type": types, ...body };
  return body; // untyped object: just recurse its values
}

function nestArray(arr: JsonValue[]): JsonValue {
  const allSingleTyped =
    arr.length > 0 && arr.every((el) => isPlainObject(el) && typeList(el).length === 1);

  if (!allSingleTyped) return arr.map(nestValue);

  // Every element is a single-typed object: group by type into arrays,
  // e.g. [ListItem, ListItem] -> { ListItem: [ {...}, {...} ] }.
  const groups: { [type: string]: JsonValue[] } = {};
  for (const el of arr) {
    const obj = el as JsonObject;
    const type = typeList(obj)[0];
    (groups[type] ??= []).push(nestBody(obj));
  }
  return groups;
}

function nestValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return nestArray(value);
  if (isPlainObject(value)) return nestObject(value);
  return value;
}

// --- public API -------------------------------------------------------------

/**
 * Extracts, normalizes, and queries schema.org JSON-LD found on a page.
 *
 * Construct it from a DOM (or DOM-like) document with {@link SchemaOrgData.fromDocument},
 * or from already-parsed objects with {@link SchemaOrgData.fromNodes}, then use
 * the query helpers ({@link SchemaOrgData.get | get}, {@link SchemaOrgData.first | first},
 * {@link SchemaOrgData.all | all}) or the type-keyed
 * {@link SchemaOrgData.toNested | toNested} view.
 *
 * @category Helpers
 * @example
 * ```ts
 * const data = SchemaOrgData.fromDocument(document);
 * data.types();               // ['Organization', 'WebPage', 'BreadcrumbList', 'Product']
 * data.first('Product')?.sku; // 'CHEM027'
 * ```
 *
 * @source
 */
export class SchemaOrgData {
  /**
   * Top-level schema.org nodes, in document order, with `@type` and `@context`
   * left intact. `@graph` wrappers are already flattened into this list.
   *
   * @example
   * ```ts
   * const data = SchemaOrgData.fromNodes(blocks);
   * data.nodes.length;      // number of top-level entities
   * data.nodes[0]['@type']; // 'Organization'
   * ```
   *
   * @source
   */
  readonly nodes: readonly SchemaNode[];

  /**
   * Wrap an already-collected list of nodes. Prefer the static factories unless
   * you have pre-filtered nodes of your own. Each node is normalized on the way
   * in: schema.org enumeration URLs in string values are reduced to their bare
   * member name (see {@link stripSchemaEnumPrefix}), leaving `@context` intact.
   *
   * @param nodes - Top-level schema.org nodes to hold.
   *
   * @example
   * ```ts
   * const data = new SchemaOrgData([
   *   { '@context': 'https://schema.org', '@type': 'Product' },
   * ]);
   * ```
   *
   * @source
   */
  constructor(nodes: SchemaNode[]) {
    this.nodes = nodes.map((node) => normalizeValue(node) as SchemaNode);
  }

  /**
   * Parse every `<script type="application/ld+json">` block under `root`,
   * flatten `@graph` wrappers and arrays, and keep only nodes whose `@context`
   * is schema.org.
   *
   * @param root - A document or element subtree to search. Defaults to the
   *   global `document` in a browser; pass a jsdom/linkedom document in Node.
   * @returns A {@link SchemaOrgData} over the discovered nodes.
   *
   * @example
   * ```ts
   * import { JSDOM } from 'jsdom';
   * const { document } = new JSDOM(html).window;
   * const data = SchemaOrgData.fromDocument(document);
   * ```
   *
   * @source
   */
  static fromDocument(root: ParentNode = document): SchemaOrgData {
    const nodes = parseScripts(root)
      .flatMap(collectNodes)
      .filter((node) => isSchemaContext(node["@context"]));
    return new SchemaOrgData(nodes);
  }

  /**
   * Build directly from already-parsed object(s), applying the same `@graph`
   * flattening and schema.org context filtering as
   * {@link SchemaOrgData.fromDocument}. Useful for tests or when the JSON-LD is
   * obtained without a DOM.
   *
   * @param input - A single parsed object or an array of them.
   * @returns A {@link SchemaOrgData} over the schema.org nodes found.
   *
   * @example
   * ```ts
   * const data = SchemaOrgData.fromNodes([
   *   { '@context': 'https://schema.org', '@type': 'Product', sku: 'CHEM027' },
   * ]);
   * ```
   *
   * @source
   */
  static fromNodes(input: JsonObject | JsonObject[]): SchemaOrgData {
    const nodes = toArray(input)
      .flatMap(collectNodes)
      .filter((node) => isSchemaContext(node["@context"]));
    return new SchemaOrgData(nodes);
  }

  /**
   * Deep-scan an arbitrary object (or array) and collect every sub-object that
   * carries a schema.org `@context`. Use this when the JSON-LD is embedded in a
   * larger app-state blob under unpredictable keys — as many storefronts do —
   * rather than provided as a clean node. Detection is by `@context`, not
   * `@type`, so unrelated framework types with their own `@type` are ignored.
   *
   * Recursion stops at each match: a context-bearing object is taken whole, and
   * its nested typed children (which inherit that context) stay inside it —
   * reach them later with {@link SchemaOrgData.all | all}.
   *
   * @param data - Any parsed JSON value to search.
   * @returns A {@link SchemaOrgData} over every schema.org node found at any depth.
   *
   * @example
   * ```ts
   * // A Bloomreach/ATG page-state object with schema buried inside:
   * const data = SchemaOrgData.fromObject(pageState);
   * data.types();          // ['BreadcrumbList', 'Product']
   * data.first('Product'); // the nested Product node
   * ```
   *
   * @source
   */
  static fromObject(data: unknown): SchemaOrgData {
    const found: SchemaNode[] = [];
    const visit = (value: JsonValue): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!isPlainObject(value)) {
        return;
      }
      if (isSchemaContext(value["@context"])) {
        found.push(value); // take the node whole; don't descend into it
        return;
      }
      for (const key of Object.keys(value)) visit(value[key]);
    };
    visit(data as JsonValue);
    return new SchemaOrgData(found);
  }

  /**
   * List the distinct `@type` values across all top-level nodes.
   *
   * @returns Each declared top-level type once, in first-seen order.
   *
   * @example
   * ```ts
   * data.types(); // ['Organization', 'WebPage', 'BreadcrumbList', 'Product']
   * ```
   *
   * @source
   */
  types(): string[] {
    const seen = new Set<string>();
    for (const node of this.nodes) {
      for (const type of typeList(node)) seen.add(type);
    }
    return [...seen];
  }

  /**
   * Test whether any top-level node declares `type`.
   *
   * @param type - The schema.org type name to look for (e.g. `'Product'`).
   * @returns `true` if at least one top-level node has that type.
   *
   * @example
   * ```ts
   * data.has('Product'); // true
   * data.has('Recipe');  // false
   * ```
   *
   * @source
   */
  has(type: string): boolean {
    return this.nodes.some((node) => typeList(node).includes(type));
  }

  /**
   * All top-level nodes declaring `type`. A node with several types matches each
   * of them, so it can be returned by more than one `get` call.
   *
   * @param type - The schema.org type name to filter by.
   * @returns Matching top-level nodes, in document order (empty if none).
   *
   * @example
   * ```ts
   * data.get('Product');        // every top-level Product node
   * data.get('Product').length; // how many there are
   * ```
   *
   * @source
   */
  get(type: string): SchemaNode[] {
    return this.nodes.filter((node) => typeList(node).includes(type));
  }

  /**
   * The first top-level node of `type`, if any.
   *
   * @param type - The schema.org type name to look for.
   * @returns The first matching node, or `undefined` when none exists.
   *
   * @example
   * ```ts
   * data.first('Product')?.sku; // 'CHEM027'
   * data.first('Recipe');       // undefined
   * ```
   *
   * @source
   */
  first(type: string): SchemaNode | undefined {
    return this.get(type)[0];
  }

  /**
   * Depth-first search for every typed object anywhere in the tree, including
   * nested ones — the `Offer` inside a `Product`, or a `PropertyValue` used as
   * an `identifier`. Omit `type` to collect all typed objects.
   *
   * @param type - Optional schema.org type to filter by; when omitted, every
   *   object carrying an `@type` is returned.
   * @returns All matching nodes at any depth, in depth-first document order.
   *
   * @example
   * ```ts
   * data.all('Offer');         // Offers wherever they are nested
   * data.all('PropertyValue'); // every identifier-style value pair
   * data.all();                // all typed objects on the page
   * ```
   *
   * @source
   */
  all(type?: string): SchemaNode[] {
    const found: SchemaNode[] = [];
    const visit = (value: JsonValue): void => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!isPlainObject(value)) {
        return;
      }
      if ("@type" in value && (type === undefined || typeList(value).includes(type))) {
        found.push(value);
      }
      for (const key of Object.keys(value)) visit(value[key]);
    };
    this.nodes.forEach(visit);
    return found;
  }

  /**
   * A type-keyed view of the data: each node's `@type` becomes the wrapping key
   * and `@type`/`@context` drop out of the body. Arrays whose elements are all
   * single-typed objects are grouped by type (a `BreadcrumbList`'s items become
   * `{ ListItem: [...] }`), and multiple top-level nodes of the same type
   * collapse into an array under that key. Optimized for readable inspection
   * rather than programmatic access.
   *
   * @returns A plain object keyed by schema.org type.
   *
   * @example
   * ```ts
   * data.toNested().BreadcrumbList.itemListElement.ListItem[0].name; // 'Home'
   * data.toNested().Product.offers.Offer.price;                      // '5.8'
   * ```
   *
   * @source
   */
  toNested(): JsonObject {
    const out: JsonObject = {};
    for (const node of this.nodes) {
      const nested = nestObject(node);
      if (!isPlainObject(nested)) continue;
      for (const [type, body] of Object.entries(nested)) {
        if (out[type] === undefined) {
          out[type] = body;
        } else {
          const existing = out[type];
          out[type] = Array.isArray(existing) ? [...existing, body] : [existing, body];
        }
      }
    }
    return out;
  }
}
