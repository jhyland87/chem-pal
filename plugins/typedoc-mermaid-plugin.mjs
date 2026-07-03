import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RendererEvent } from "typedoc";

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
  const jsAsset = "mermaid-diagrams.js";

  // Register custom options
  app.options.addDeclaration({
    name: "mermaidVersion",
    help: "[Mermaid Plugin] Mermaid.js version to load from CDN.",
    type: 0, // ParameterType.String
    defaultValue: "11",
  });

  app.options.addDeclaration({
    name: "mermaidContainerHeight",
    help: "[Mermaid Plugin] Height of the diagram container in pixels.",
    type: 0, // ParameterType.String
    defaultValue: "600",
  });

  app.options.addDeclaration({
    name: "mermaidPanZoom",
    help: "[Mermaid Plugin] Enable pan & zoom on diagrams.",
    type: 4, // ParameterType.Boolean
    defaultValue: true,
  });

  app.options.addDeclaration({
    name: "mermaidMinZoom",
    help: "[Mermaid Plugin] Minimum zoom level.",
    type: 0, // ParameterType.String
    defaultValue: "0.3",
  });

  app.options.addDeclaration({
    name: "mermaidMaxZoom",
    help: "[Mermaid Plugin] Maximum zoom level.",
    type: 0, // ParameterType.String
    defaultValue: "10",
  });

  // Defer reading options until render time (after all config is loaded)
  function getOptions() {
    return {
      mermaidVersion: app.options.getValue("mermaidVersion"),
      containerHeight: app.options.getValue("mermaidContainerHeight"),
      panZoom: app.options.getValue("mermaidPanZoom"),
      minZoom: app.options.getValue("mermaidMinZoom"),
      maxZoom: app.options.getValue("mermaidMaxZoom"),
    };
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
    return (
      `<script src="${prefix}assets/${jsAsset}"` +
      ` data-mermaid-version="${opts.mermaidVersion}"` +
      ` data-container-height="${opts.containerHeight}"` +
      ` data-pan-zoom="${opts.panZoom}"` +
      ` data-min-zoom="${opts.minZoom}"` +
      ` data-max-zoom="${opts.maxZoom}"><\/script>`
    );
  }

  // ─── Asset copying ─────────────────────────────────────────────────
  app.renderer.on(RendererEvent.END, (event) => {
    const dest = path.join(event.outputDirectory, "assets");
    try {
      fs.mkdirSync(dest, { recursive: true });
      for (const file of [cssAsset, jsAsset]) {
        fs.copyFileSync(path.join(assetsDir, file), path.join(dest, file));
      }
    } catch (err) {
      app.logger.error(`[Mermaid Plugin] Failed to copy assets: ${err}`);
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
        const escaped = content
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

        // Controls are added client-side by mermaid-diagrams.js.
        const div = `<div class="mermaid-block"><div class="mermaid">${escaped}</div></div>`;
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
