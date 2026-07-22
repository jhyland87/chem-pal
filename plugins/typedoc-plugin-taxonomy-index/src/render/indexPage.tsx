import { JSX, type DefaultThemeRenderContext, type PageEvent, type Reflection } from 'typedoc';
import type { ResolvedOptions } from '../options.js';
import type { Taxonomy, TaxonomyTerm, TermKind } from '../types.js';

/** How many member names to preview on a term card before eliding. */
const PREVIEW_LIMIT = 6;

/**
 * Renders one term as a card: title, member count, description, and a short
 * preview of member names.
 * @param context The render context for the page being generated.
 * @param term The term to summarise.
 * @param detailPages Whether a per-term detail page exists to link to.
 * @returns A card element.
 * @example `termCard(ctx, helpersTerm, true)` links to `taxonomy-category-helpers.html`.
 * @source
 */
function termCard(
  context: DefaultThemeRenderContext,
  term: TaxonomyTerm,
  detailPages: boolean,
): JSX.Element {
  const preview = term.members.slice(0, PREVIEW_LIMIT);
  const remaining = term.members.length - preview.length;
  const href = `taxonomy-${term.slug}.html`;

  return (
    <section class="tsd-taxonomy-card" id={term.slug}>
      <h3 class="tsd-taxonomy-card-title">
        {detailPages ? (
          <a href={context.relativeURL(href)}>{term.title}</a>
        ) : (
          <span>{term.title}</span>
        )}
        <span class="tsd-taxonomy-count" title={`${term.members.length} members`}>
          {String(term.members.length)}
        </span>
      </h3>
      {term.ownerCount > 1 && (
        <p class="tsd-taxonomy-card-owners">merged from {String(term.ownerCount)} files</p>
      )}
      {term.description && context.displayParts(term.description)}
      <ul class="tsd-taxonomy-preview">
        {preview.map((member) => (
          <li>{member.name}</li>
        ))}
        {remaining > 0 && <li class="tsd-taxonomy-preview-more">+{String(remaining)} more</li>}
      </ul>
    </section>
  );
}

/**
 * Renders one taxonomy section (all categories, or all groups) as a card grid.
 * @param context The render context for the page being generated.
 * @param heading Section heading text.
 * @param kind Which taxonomy is being rendered, used for the section anchor.
 * @param terms The ordered terms in this section.
 * @param detailPages Whether per-term detail pages exist to link to.
 * @returns The section element, or undefined when there are no terms.
 * @example `taxonomySection(ctx, 'Categories', 'category', terms, true)`
 * @source
 */
function taxonomySection(
  context: DefaultThemeRenderContext,
  heading: string,
  kind: TermKind,
  terms: readonly TaxonomyTerm[],
  detailPages: boolean,
): JSX.Element | undefined {
  if (terms.length === 0) {
    return undefined;
  }
  const memberTotal = terms.reduce((sum, term) => sum + term.members.length, 0);

  return (
    <section class="tsd-panel tsd-taxonomy-section">
      <h2 id={`${kind}-index`}>
        {heading}
        <span class="tsd-taxonomy-section-meta">
          {String(terms.length)} terms &middot; {String(memberTotal)} entries
        </span>
      </h2>
      <div class="tsd-taxonomy-grid">
        {terms.map((term) => termCard(context, term, detailPages))}
      </div>
    </section>
  );
}

/**
 * Renders the taxonomy landing page body.
 *
 * Also populates `page.pageHeadings` so the theme's "On This Page" sidebar lists
 * every term, matching the anchors emitted by {@link termCard}.
 * @param context The render context for the page being generated.
 * @param page The synthetic page event for this page.
 * @param taxonomy The collected project-global taxonomy.
 * @param options The resolved plugin options.
 * @returns The page body element.
 * @example `indexPage(ctx, page, taxonomy, options)`
 * @source
 */
export function indexPage(
  context: DefaultThemeRenderContext,
  page: PageEvent<Reflection>,
  taxonomy: Taxonomy,
  options: ResolvedOptions,
): JSX.Element {
  for (const [heading, terms] of [
    ['Categories', taxonomy.categories],
    ['Groups', taxonomy.groups],
  ] as const) {
    if (terms.length === 0) {
      continue;
    }
    page.startNewSection(heading);
    for (const term of terms) {
      page.pageHeadings.push({ link: `#${term.slug}`, text: term.title });
    }
  }

  return (
    <div class="tsd-taxonomy col-content">
      <h1>{options.title}</h1>
      <p class="tsd-taxonomy-lead">
        Every <code>@category</code> and <code>@group</code> across the project, merged across
        files.
      </p>
      {taxonomySection(context, 'Categories', 'category', taxonomy.categories, options.detailPages)}
      {taxonomySection(context, 'Groups', 'group', taxonomy.groups, options.detailPages)}
    </div>
  );
}
