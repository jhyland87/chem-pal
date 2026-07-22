import type { CommentDisplayPart, DeclarationReflection, DocumentReflection } from "typedoc";

/**
 * A reflection that can appear as a member of a category or group. Mirrors the
 * declared element type of `ReflectionCategory.children` / `ReflectionGroup.children`.
 * @category Taxonomy
 */
export type TaxonomyMember = DeclarationReflection | DocumentReflection;

/**
 * Which of TypeDoc's two taxonomies a term belongs to.
 * @category Taxonomy
 */
export type TermKind = "category" | "group";

/**
 * How terms sharing a title across different files are combined.
 *
 * - `byTitle` — exact title match (the default, and what makes the index global)
 * - `byTitleCaseInsensitive` — as above but case-folded; the first-seen casing wins
 * - `none` — every owning container keeps its own term, qualified by owner name
 * @category Taxonomy
 */
export type MergeMode = "byTitle" | "byTitleCaseInsensitive" | "none";

/**
 * How members are ordered within a term.
 * @category Taxonomy
 */
export type MemberSort = "alphabetical" | "source-order" | "kind";

/**
 * A single `@category` or `@group` value, with every reflection tagged with it
 * across the whole project.
 * @category Taxonomy
 */
export interface TaxonomyTerm {
  /** Display title, e.g. `"Science Helpers"`. */
  title: string;
  /** Which taxonomy this term belongs to. */
  kind: TermKind;
  /** URL-safe identifier, used for the detail page filename and anchors. */
  slug: string;
  /** Rendered from `@categoryDescription` / `@groupDescription`, if present. */
  description?: readonly CommentDisplayPart[];
  /** Every reflection tagged with this term, deduped by reflection id. */
  members: TaxonomyMember[];
  /** Number of distinct containers that contributed members. */
  ownerCount: number;
}

/**
 * The project-global taxonomy: every category and every group, merged.
 * @category Taxonomy
 */
export interface Taxonomy {
  categories: TaxonomyTerm[];
  groups: TaxonomyTerm[];
}
