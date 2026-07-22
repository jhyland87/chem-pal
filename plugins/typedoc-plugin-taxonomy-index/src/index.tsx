import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  DefaultTheme,
  JSX,
  PageEvent,
  RendererEvent,
  type Application,
  type DefaultThemeRenderContext,
  type Reflection,
  type RendererEvent as RendererEventType,
} from "typedoc";
import { TAXONOMY_CSS } from "./assets.js";
import { collectTaxonomy } from "./collect.js";
import { declareOptions, resolveOptions, type ResolvedOptions } from "./options.js";
import { indexPage } from "./render/indexPage.js";
import { memberRow } from "./render/memberRow.js";
import { termPage } from "./render/termPage.js";
import type { Taxonomy } from "./types.js";

/** Where the stylesheet is written, relative to the output directory. */
const CSS_PATH = "assets/taxonomy.css";

/** One page this plugin is responsible for emitting. */
interface TaxonomyPage {
  url: string;
  title: string;
  render: (context: DefaultThemeRenderContext, page: PageEvent<Reflection>) => JSX.Element;
}

/**
 * Builds the list of pages to emit for a collected taxonomy.
 *
 * All pages live at the output root rather than in a `taxonomy/` subdirectory:
 * `urlTo` computes links relative to `page.model`, and the model here is the
 * project (whose own URL sits at the root). A nested page would produce links
 * missing a `../` segment.
 * @param taxonomy The collected project-global taxonomy.
 * @param options The resolved plugin options.
 * @returns The pages to render, index page first.
 * @example `buildPageList(taxonomy, options).map((p) => p.url) // => ['taxonomy.html', 'taxonomy-category-utils.html', ...]`
 * @source
 */
function buildPageList(taxonomy: Taxonomy, options: ResolvedOptions): TaxonomyPage[] {
  const pages: TaxonomyPage[] = [
    {
      url: options.out,
      title: options.title,
      render: (context, page) => indexPage(context, page, taxonomy, options),
    },
  ];

  if (!options.detailPages) {
    return pages;
  }

  for (const term of [...taxonomy.categories, ...taxonomy.groups]) {
    pages.push({
      url: `taxonomy-${term.slug}.html`,
      title: term.title,
      render: (context, page) => termPage(context, page, term, options, memberRow),
    });
  }
  return pages;
}

/**
 * Creates the synthetic page event a taxonomy page is rendered against.
 *
 * The model is the project reflection — a real `Reflection`, which `defaultLayout`,
 * `urlTo` and `relativeURL` all require. `pageKind` stays `"reflection"` so any
 * theme hooks keyed off it behave normally.
 * @param event The active render event.
 * @param page The page being emitted.
 * @returns A page event ready to hand to `getRenderContext`.
 * @example `makePageEvent(event, { url: 'taxonomy.html', ... })`
 * @source
 */
function makePageEvent(event: RendererEventType, page: TaxonomyPage): PageEvent<Reflection> {
  const pageEvent = new PageEvent<Reflection>(event.project);
  pageEvent.project = event.project;
  pageEvent.url = page.url;
  pageEvent.filename = join(event.outputDirectory, page.url);
  pageEvent.pageKind = "reflection";
  return pageEvent;
}

/**
 * Emits every taxonomy page plus the stylesheet.
 * @param app The TypeDoc application.
 * @param event The active render event.
 * @param options The resolved plugin options.
 * @example `await emitTaxonomy(app, event, options)`
 * @source
 */
async function emitTaxonomy(
  app: Application,
  event: RendererEventType,
  options: ResolvedOptions,
): Promise<void> {
  const theme = app.renderer.theme;
  if (!(theme instanceof DefaultTheme)) {
    app.logger.warn(
      "typedoc-plugin-taxonomy-index requires a theme extending DefaultTheme; skipping taxonomy pages.",
    );
    return;
  }

  const taxonomy = collectTaxonomy(event.project, options);
  if (taxonomy.categories.length === 0 && taxonomy.groups.length === 0) {
    app.logger.warn("typedoc-plugin-taxonomy-index found no @category or @group tags; skipping.");
    return;
  }

  const cssTarget = join(event.outputDirectory, CSS_PATH);
  await mkdir(dirname(cssTarget), { recursive: true });
  await writeFile(cssTarget, TAXONOMY_CSS, "utf-8");

  for (const page of buildPageList(taxonomy, options)) {
    const pageEvent = makePageEvent(event, page);
    const context = theme.getRenderContext(pageEvent);
    const html = `<!DOCTYPE html>${JSX.renderElement(
      context.defaultLayout((props) => page.render(context, props), pageEvent),
    )}\n`;
    await mkdir(dirname(pageEvent.filename), { recursive: true });
    await writeFile(pageEvent.filename, html, "utf-8");
  }

  app.logger.info(
    `typedoc-plugin-taxonomy-index wrote ${options.out} (${taxonomy.categories.length} categories, ${taxonomy.groups.length} groups).`,
  );
}

/**
 * TypeDoc plugin entry point.
 *
 * Everything happens on `RendererEvent.BEGIN`: TypeDoc calls `options.reset()`
 * after plugins load, so option *values* read during `load()` — and anything set
 * with `setValue` — are discarded. The pages themselves are written from a
 * post-render job rather than injected as `PageDefinition`s, because
 * `DefaultTheme.render()` throws on unrecognised page kinds; writing files
 * directly keeps the plugin theme-agnostic.
 * @param app The TypeDoc application.
 * @example
 * ```json
 * // typedoc.json
 * { "plugin": ["typedoc-plugin-taxonomy-index"], "taxonomyTitle": "Taxonomy" }
 * ```
 * @source
 */
export function load(app: Application): void {
  declareOptions(app);
  // Renderer hooks are not reset between renders, so only register once.
  let styleHookRegistered = false;

  app.renderer.on(
    RendererEvent.BEGIN,
    () => {
      const options = resolveOptions(app);
      if (!options.enabled) {
        return;
      }

      if (options.sidebarLink) {
        const existing = app.options.getValue("sidebarLinks");
        app.options.setValue("sidebarLinks", { ...existing, [options.title]: options.out });
      }

      if (!styleHookRegistered) {
        styleHookRegistered = true;
        app.renderer.hooks.on("head.end", (context) => (
          <link rel="stylesheet" href={context.relativeURL(CSS_PATH)} />
        ));
      }

      // Registered inside BEGIN because Renderer clears this array on each render().
      app.renderer.postRenderAsyncJobs.push(async (event) => {
        await emitTaxonomy(app, event, options);
      });
    },
    1000,
  );
}
