import { RendererEvent } from "typedoc";

/**
 * typedoc-linkify-plugin
 *
 * Narrows markdown-it's `linkify` so it only auto-links URLs carrying an
 * explicit scheme.
 *
 * `markdownItOptions.linkify` is on (see configs/typedoc.json) so that bare URLs
 * in `@see` tags render as links. But linkify's "fuzzy link" heuristic also
 * treats any `word.tld` in prose as a URL, which turned ordinary doc-comment
 * sentences into bogus links: "…for cleaning. By…" became
 * <a href="http://cleaning.By">, and passing mentions of `schema.org`,
 * `myshopify.com`, `UOM.KG`, `Judge.me` etc. all linked to nonexistent pages.
 * Disabling `fuzzyLink` keeps `https://example.com` linking while leaving prose
 * alone.
 *
 * `fuzzyEmail` is deliberately left on — the author address in the docs footer
 * relies on it.
 */

/**
 * Registers the markdown-it tweak.
 *
 * `markdownItLoader` is a function-valued option, so it cannot be set from the
 * JSON config — hence a plugin. It also cannot be set from `load()`: TypeDoc's
 * `_bootstrap()` runs `options.reset()` *after* plugins load, discarding
 * anything set there. Installing it on `RendererEvent.BEGIN` with a high
 * priority puts it in place just before MarkedPlugin builds its parser (higher
 * priority runs first, and MarkedPlugin registers at the default priority).
 * @param {import('typedoc').Application} app The TypeDoc application.
 */
export function load(app) {
  app.renderer.on(
    RendererEvent.BEGIN,
    () => {
      const previousLoader = app.options.getValue("markdownItLoader");

      app.options.setValue("markdownItLoader", (parser) => {
        previousLoader(parser);
        parser.linkify.set({ fuzzyLink: false });
      });
    },
    1000,
  );
}
