import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ParameterType, RendererEvent } from "typedoc";
import { escapeHtml, kebabize } from "./utils.mjs";

const PLUGIN_CFG_NAME = "mermaidPlugin";
/**
 * typedoc-plugin-mermaid-28
 *
 * A TypeDoc plugin for rendering Mermaid.js diagrams in generated documentation.
 * Compatible with TypeDoc 0.28+ (which introduced breaking changes to the plugin API).
 *
 * Features:
 * - Renders ```mermaid fenced code blocks in JSDoc comments and project documents
 * - Interactive pan & zoom via svg-pan-zoom (scroll to zoom, click-drag to pan)
 * - Zoom controls (+, −, Reset) and a full-screen toggle on each diagram
 * - Dark mode support (respects TypeDoc's theme toggle)
 * - Configurable mermaid version, container height, and zoom behavior
 * - Zero npm dependencies — mermaid and svg-pan-zoom loaded from CDN at runtime
 *
 * The browser-side CSS and JS live in ./mermaid-assets and are copied into the
 * output's assets/ directory. This module only orchestrates: it registers
 * options, extracts mermaid code blocks, and injects the <link>/<script> tags
 * (passing config to the script via data-* attributes).
 *
 * Why this exists:
 * The original typedoc-plugin-mermaid (v1.12.0) only supports TypeDoc ≤0.26.
 * TypeDoc 0.28 changed the EventDispatcher API — higher priority listeners now
 * run first, and markdown-it processes content inside HTML blocks. This plugin
 * uses a placeholder strategy to bypass markdown-it entirely, then injects the
 * mermaid content in the final HTML output.
 *
 * @param {import("typedoc").Application} app
 */
export function load(app) {
  const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "mermaid-assets");
  const cssAsset = "mermaid-diagrams.css";
  // Frontmatter parser must load before the runtime, which reads the global it
  // exposes. Order matters — keep it first in the list.
  const jsAssets = ["mermaid-frontmatter.js", "mermaid-diagrams.js"];

  // Defaults for every mermaidPlugin sub-option. TypeDoc's Object parameter
  // type shallow-merges user-set keys over these.
  const defaultOptions = {
    version: "11", // string: CDN version tag, e.g. "11", "10.9.1", "latest"
    containerHeight: 600,
    // "pan": scroll/drag pans, pinch zooms | "wheel": wheel zooms | "none": off
    zoomControl: "pan",
    minZoom: 0.3,
    maxZoom: 10,
    disableMaximize: false,
  };

  // Register the single object option. Configure via a `mermaidPlugin` object
  // in typedoc.json (e.g. { "mermaidPlugin": { "maxZoom": "5" } }) or on the
  // CLI with dotted keys (e.g. --mermaidPlugin.maxZoom 5).
  app.options.addDeclaration({
    name: PLUGIN_CFG_NAME,
    help: `[${PLUGIN_CFG_NAME}] Options object: ${Object.keys(defaultOptions).join(", ")}.`,
    type: ParameterType.Object,
    defaultValue: defaultOptions,
  });

  // Defer reading options until render time (after all config is loaded).
  // Spread over defaults so a partially-merged object still has every key.
  function getOptions() {
    return { ...defaultOptions, ...app.options.getValue(PLUGIN_CFG_NAME) };
  }

  // Relative "../" prefix from a page URL back to the output root, so asset
  // links resolve at any nesting depth (matches how TypeDoc links its assets).
  function relativePrefix(url) {
    const depth = (url || "").split("/").length - 1;
    return "../".repeat(depth);
  }

  function styleLink(prefix) {
    return `<link rel="stylesheet" href="${prefix}assets/${cssAsset}"/>`;
  }

  function scriptTag(prefix, opts) {
    const dataAttributes = Object.entries(opts)
      .map(([key, value]) => `data-${kebabize(key)}="${value}"`)
      .join(" ");

    // Config data-* attributes go on the runtime script (the last one), which
    // reads them via document.currentScript. Preceding scripts (the frontmatter
    // parser) load plain, in order.
    return jsAssets
      .map((asset, index) => {
        const attrs = index === jsAssets.length - 1 ? ` ${dataAttributes}` : "";
        return `<script src="${prefix}assets/${asset}"${attrs}></script>`;
      })
      .join("");
  }

  // ─── Asset copying ─────────────────────────────────────────────────
  app.renderer.on(RendererEvent.END, (event) => {
    const dest = path.join(event.outputDirectory, "assets");
    try {
      fs.mkdirSync(dest, { recursive: true });
      for (const file of [cssAsset, ...jsAssets]) {
        fs.copyFileSync(path.join(assetsDir, file), path.join(dest, file));
      }
    } catch (err) {
      app.logger.error(`[${PLUGIN_CFG_NAME}] Failed to copy assets: ${err}`);
    }
  });

  // ─── Markdown parsing ──────────────────────────────────────────────
  // Store mermaid blocks extracted during markdown parsing.
  // We replace them with HTML comments that markdown-it passes through
  // untouched, then swap them back in the final HTML via endPage.
  const mermaidBlocks = new Map();
  let blockCounter = 0;

  app.renderer.on(
    "parseMarkdown",
    (event) => {
      event.parsedText = event.parsedText.replace(
        /^```mermaid[ \t\r]*\n([\s\S]*?)^```[ \t]*$/gm,
        (_match, content) => {
          const id = `__MERMAID_PLACEHOLDER_${blockCounter++}__`;
          mermaidBlocks.set(id, content.trim());
          return `<!--${id}-->`;
        },
      );
    },
    100, // Higher priority = runs before TypeDoc's markdown-it (priority 0)
  );

  // ─── Page post-processing ──────────────────────────────────────────
  app.renderer.on("endPage", (event) => {
    if (!event.contents) return;

    let hasBlocks = false;

    for (const [id, content] of mermaidBlocks) {
      const placeholder = `<!--${id}-->`;
      if (event.contents.includes(placeholder)) {
        hasBlocks = true;
        // Controls are added client-side by mermaid-diagrams.js.
        const div = `<div class="mermaid-block"><div class="mermaid">${escapeHtml(
          content,
        )}</div></div>`;
        event.contents = event.contents.replace(placeholder, div);
        mermaidBlocks.delete(id);
      }
    }

    if (!hasBlocks) return;

    const opts = getOptions();
    const prefix = relativePrefix(event.url);

    const headClose = event.contents.indexOf("</head>");
    if (headClose !== -1) {
      event.contents =
        event.contents.slice(0, headClose) + styleLink(prefix) + event.contents.slice(headClose);
    }

    const bodyClose = event.contents.lastIndexOf("</body>");
    if (bodyClose !== -1) {
      event.contents =
        event.contents.slice(0, bodyClose) +
        scriptTag(prefix, opts) +
        event.contents.slice(bodyClose);
    }
  });
}
