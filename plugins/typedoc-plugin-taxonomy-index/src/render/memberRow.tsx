import { JSX, type DefaultThemeRenderContext } from "typedoc";
import type { TaxonomyMember } from "../types.js";

/**
 * Renders one member of a term as a linked row: kind icon, name, and summary.
 *
 * The owning module is deliberately omitted — term pages already bucket members
 * under a module heading, so repeating it on every row is noise.
 *
 * Links go through `context.urlTo` so they stay correct regardless of the active
 * router (`kind`, `structure`, `category`, …). Members whose reflection has no
 * own document render unlinked rather than pointing at a 404.
 * @param context The render context for the page being generated.
 * @param member The reflection to render.
 * @returns A `<li>` element for the member list.
 * @example `memberRow(ctx, helperRefl)` renders a row linking to `functions/toCurrency.html`.
 * @source
 */
export function memberRow(context: DefaultThemeRenderContext, member: TaxonomyMember): JSX.Element {
  // urlTo throws for targets the router never assigned a URL to (nested type
  // literals, un-exported signatures), so gate on hasUrl rather than catching.
  const url = context.router.hasUrl(member) ? context.urlTo(member) : undefined;
  const summary = member.comment?.summary;

  return (
    <li class={`tsd-taxonomy-member ${context.getReflectionClasses(member)}`}>
      <span class="tsd-taxonomy-member-head">
        {context.reflectionIcon(member)}
        {url ? (
          <a href={url} class="tsd-taxonomy-member-name">
            {member.name}
          </a>
        ) : (
          <span class="tsd-taxonomy-member-name">{member.name}</span>
        )}
      </span>
      {summary && summary.length > 0 && (
        <span class="tsd-taxonomy-member-summary">{context.displayParts(summary)}</span>
      )}
    </li>
  );
}
