import { JSX, type DefaultThemeRenderContext, type PageEvent, type Reflection } from "typedoc";
import { owningModule, slugify } from "../collect.js";
import type { ResolvedOptions } from "../options.js";
import type { TaxonomyMember, TaxonomyTerm } from "../types.js";

/**
 * Buckets a term's members by their owning module, preserving the member order
 * already established by the resolved sort strategy.
 * @param members The ordered members of a term.
 * @returns Buckets of `[moduleName, members]`, in first-appearance order.
 * @example `groupByModule(members) // => [['helpers/cas', [...]], ['utils/text', [...]]]`
 * @source
 */
function groupByModule(members: readonly TaxonomyMember[]): Array<[string, TaxonomyMember[]]> {
  const buckets = new Map<string, TaxonomyMember[]>();
  for (const member of members) {
    const name = owningModule(member).getFriendlyFullName();
    const bucket = buckets.get(name);
    if (bucket) {
      bucket.push(member);
      continue;
    }
    buckets.set(name, [member]);
  }
  return [...buckets.entries()];
}

/**
 * Renders the detail page for a single category or group.
 *
 * Members are bucketed by owning module so it is immediately visible that a term
 * spans several files — the thing TypeDoc's per-container categories cannot show.
 * @param context The render context for the page being generated.
 * @param page The synthetic page event for this page.
 * @param term The term to render.
 * @param options The resolved plugin options.
 * @param renderMember Row renderer for an individual member.
 * @returns The page body element.
 * @example `termPage(ctx, page, helpersTerm, options, memberRow)`
 * @source
 */
export function termPage(
  context: DefaultThemeRenderContext,
  page: PageEvent<Reflection>,
  term: TaxonomyTerm,
  options: ResolvedOptions,
  renderMember: (context: DefaultThemeRenderContext, member: TaxonomyMember) => JSX.Element,
): JSX.Element {
  const buckets = groupByModule(term.members);
  const label = term.kind === "category" ? "Category" : "Group";

  for (const [moduleName] of buckets) {
    page.pageHeadings.push({ link: `#${slugify(moduleName)}`, text: moduleName });
  }

  return (
    <div class="tsd-taxonomy col-content">
      <p class="tsd-taxonomy-breadcrumb">
        <a href={context.relativeURL(options.out)}>{options.title}</a> / {label}
      </p>
      <h1>{term.title}</h1>
      <p class="tsd-taxonomy-lead">
        {String(term.members.length)} entries across {String(buckets.length)} modules.
      </p>
      {term.description && context.displayParts(term.description)}
      {buckets.map(([moduleName, members]) => (
        <section class="tsd-panel tsd-taxonomy-module">
          <h2 id={slugify(moduleName)}>
            {moduleName}
            <span class="tsd-taxonomy-count">{String(members.length)}</span>
          </h2>
          <ul class="tsd-taxonomy-members">
            {members.map((member) => renderMember(context, member))}
          </ul>
        </section>
      ))}
    </div>
  );
}
