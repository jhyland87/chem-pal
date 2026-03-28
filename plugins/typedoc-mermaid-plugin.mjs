/**
 * typedoc-plugin-mermaid-28
 *
 * A TypeDoc plugin for rendering Mermaid.js diagrams in generated documentation.
 * Compatible with TypeDoc 0.28+ (which introduced breaking changes to the plugin API).
 *
 * Features:
 * - Renders ```mermaid fenced code blocks in JSDoc comments and project documents
 * - Interactive pan & zoom via svg-pan-zoom (scroll to zoom, click-drag to pan)
 * - Zoom controls (+, −, Reset) on each diagram
 * - Dark mode support (respects TypeDoc's theme toggle)
 * - Configurable mermaid version, container height, and zoom behavior
 * - Zero npm dependencies — mermaid and svg-pan-zoom loaded from CDN at runtime
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

  function buildStyle(opts) {
    return `
<style>
.mermaid-block {
  margin: 1em 0;
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}
:root[data-theme="dark"] .mermaid-block,
body.dark .mermaid-block {
  border-color: #444;
  background: #1e1e1e;
}
.mermaid-block .mermaid {
  min-height: 300px;
}
.mermaid-block .mermaid svg {
  width: 100% !important;
  height: ${opts.containerHeight}px !important;
}
.mermaid-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  z-index: 10;
}
.mermaid-controls button {
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  opacity: 0.8;
  transition: opacity 0.2s;
}
.mermaid-controls button:hover {
  opacity: 1;
  background: #f0f0f0;
}
:root[data-theme="dark"] .mermaid-controls button,
body.dark .mermaid-controls button {
  background: #333;
  border-color: #555;
  color: #ddd;
}
:root[data-theme="dark"] .mermaid-controls button:hover,
body.dark .mermaid-controls button:hover {
  background: #444;
}
</style>`;
  }

  function buildScript(opts) {
    const panZoomScript = opts.panZoom
      ? `<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js"><\/script>`
      : "";

    const panZoomInit = opts.panZoom
      ? `
        const panZoomInstance = window.svgPanZoom(svgEl, {
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
          minZoom: ${opts.minZoom},
          maxZoom: ${opts.maxZoom},
          zoomScaleSensitivity: 0.3,
        });
        const block = el.closest(".mermaid-block");
        if (block) {
          const resetBtn = block.querySelector(".mermaid-btn-reset");
          const zoomInBtn = block.querySelector(".mermaid-btn-zoomin");
          const zoomOutBtn = block.querySelector(".mermaid-btn-zoomout");
          if (resetBtn) resetBtn.addEventListener("click", () => { panZoomInstance.resetZoom(); panZoomInstance.center(); });
          if (zoomInBtn) zoomInBtn.addEventListener("click", () => panZoomInstance.zoomIn());
          if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => panZoomInstance.zoomOut());
        }
        const ro = new ResizeObserver(() => { panZoomInstance.resize(); panZoomInstance.fit(); panZoomInstance.center(); });
        ro.observe(el);`
      : "";

    return `${panZoomScript}
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@${opts.mermaidVersion}/dist/mermaid.esm.min.mjs";
import elkLayouts from "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk/dist/mermaid-layout-elk.esm.min.mjs";

mermaid.registerLayoutLoaders(elkLayouts);
mermaid.initialize({ startOnLoad: false, securityLevel: "loose", flowchart: { defaultRenderer: "elk" } });

// Create an off-screen container for mermaid to render in.
// This avoids layout issues caused by theme CSS constraining the content area.
const offscreen = document.createElement("div");
offscreen.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:4000px;height:4000px;visibility:hidden;";
document.body.appendChild(offscreen);

async function renderOneDiagram(el, code, maxRetries = 3) {
  const diagramLabel = code.substring(0, 60).replace(/\\n/g, " ").trim() + "...";
  console.log("%c[Mermaid] Starting render for: " + diagramLabel, "color: #2196F3; font-weight: bold");
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const id = "mermaid-" + Math.random().toString(36).slice(2, 10);
    const t0 = performance.now();
    try {
      // Re-initialize mermaid before each retry to reset internal state
      if (attempt > 1) {
        console.log("%c[Mermaid] Attempt " + attempt + "/" + maxRetries + " (re-initializing mermaid...)", "color: #FF9800");
        mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
      } else {
        console.log("%c[Mermaid] Attempt " + attempt + "/" + maxRetries, "color: #607D8B");
      }
      const { svg } = await mermaid.render(id, code, offscreen);
      const elapsed = (performance.now() - t0).toFixed(1);
      console.log("%c[Mermaid] ✓ Rendered successfully on attempt " + attempt + " (" + elapsed + "ms)", "color: #4CAF50; font-weight: bold");
      el.innerHTML = svg;
      const svgEl = el.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "100%";
        svgEl.style.height = "100%";
        svgEl.removeAttribute("height");
        ${panZoomInit}
      }
      return; // success
    } catch (e) {
      const elapsed = (performance.now() - t0).toFixed(1);
      console.warn("%c[Mermaid] ✗ Attempt " + attempt + "/" + maxRetries + " failed (" + elapsed + "ms): " + e.message, "color: #F44336; font-weight: bold");
      // Clean up any leftover SVG from failed render
      const stale = offscreen.querySelector("#d" + id);
      if (stale) stale.remove();
      if (attempt === maxRetries) {
        console.error("%c[Mermaid] ✗ All " + maxRetries + " attempts failed", "color: #F44336; font-weight: bold");
        el.innerHTML = "<pre style='color:red'>Mermaid syntax error: " + e.message + "<\\/pre>";
      }
    }
  }
}

async function renderDiagrams() {
  const elements = document.querySelectorAll(".mermaid-block .mermaid");
  console.log("%c[Mermaid] Found " + elements.length + " diagram(s) to render", "color: #2196F3; font-weight: bold");
  const t0 = performance.now();
  for (const el of elements) {
    const code = el.textContent;
    await renderOneDiagram(el, code);
  }
  const elapsed = (performance.now() - t0).toFixed(1);
  console.log("%c[Mermaid] All diagrams processed in " + elapsed + "ms", "color: #2196F3; font-weight: bold");
}

// Wait for fonts to load before rendering — dagre measures text via getBBox()
// and wrong font metrics cause "Could not find a suitable point" layout errors.
async function waitAndRender() {
  if (document.readyState === "loading") {
    await new Promise(resolve => document.addEventListener("DOMContentLoaded", resolve));
  }
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
    console.log("%c[Mermaid] Fonts loaded, starting render", "color: #2196F3");
  }
  await renderDiagrams();
}
waitAndRender();

<\/script>`;
  }

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

    const opts = getOptions();
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

        const controls = opts.panZoom
          ? `<div class="mermaid-controls">
              <button class="mermaid-btn-zoomin" title="Zoom in">+</button>
              <button class="mermaid-btn-zoomout" title="Zoom out">&minus;</button>
              <button class="mermaid-btn-reset" title="Reset view">Reset</button>
            </div>`
          : "";

        const div = `<div class="mermaid-block">${controls}<div class="mermaid">${escaped}</div></div>`;
        event.contents = event.contents.replace(placeholder, div);
        mermaidBlocks.delete(id);
      }
    }

    if (!hasBlocks) return;

    const headClose = event.contents.indexOf("</head>");
    if (headClose !== -1) {
      event.contents =
        event.contents.slice(0, headClose) +
        buildStyle(opts) +
        event.contents.slice(headClose);
    }

    const bodyClose = event.contents.lastIndexOf("</body>");
    if (bodyClose !== -1) {
      event.contents =
        event.contents.slice(0, bodyClose) +
        buildScript(opts) +
        event.contents.slice(bodyClose);
    }
  });
}
