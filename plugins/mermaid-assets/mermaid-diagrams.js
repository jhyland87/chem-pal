/*
 * Client runtime for the TypeDoc mermaid plugin.
 *
 * Injected as a classic <script> tag on any page that contains a rendered
 * diagram. Configuration is passed by the plugin as data-* attributes on that
 * tag and read here via document.currentScript — no values are hardcoded on the
 * server side. mermaid (and, when enabled, svg-pan-zoom) load from CDN at runtime.
 */
(function () {
  "use strict";

  // Captured synchronously: document.currentScript is only valid during the
  // script's initial execution, before any await.
  const script = document.currentScript;
  const cfg = {
    version: script.dataset.mermaidVersion || "11",
    panZoom: script.dataset.panZoom === "true",
    minZoom: Number(script.dataset.minZoom || "0.3"),
    maxZoom: Number(script.dataset.maxZoom || "10"),
    containerHeight: script.dataset.containerHeight || "600",
  };

  // Non-maximized diagram height is a build option; hand it to the stylesheet.
  document.documentElement.style.setProperty(
    "--mermaid-container-height",
    cfg.containerHeight + "px",
  );

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Smallest zoom allowed, as a fraction of the fit zoom. svg-pan-zoom reports
  // getZoom() === 1.0 immediately after fit(), so clamping the floor just below
  // 1.0 keeps the whole diagram visible with a small margin — it can never be
  // zoomed out far enough to look lost or "stuck".
  const MIN_ZOOM_FIT_RATIO = 0.9;

  function limitZoomOut(pz) {
    pz.setMinZoom(pz.getZoom() * MIN_ZOOM_FIT_RATIO);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = Object.assign(document.createElement("script"), {
        src: src,
        onload: resolve,
        onerror: () => reject(new Error("Failed to load " + src)),
      });
      document.head.appendChild(el);
    });
  }

  // ── Controls ─────────────────────────────────────────────────────────
  const MAXIMIZE_ICON =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">' +
    '<path d="M2 2h4v1.5H3.5V6H2V2zm8 0h4v4h-1.5V3.5H10V2zM3.5 10v2.5H6V14H2v-4h1.5zm9 0H14v4h-4v-1.5h2.5V10z"/></svg>';

  const createButton = (props) => Object.assign(document.createElement("button"), props);

  function getButtons(maximizeIcon) {
    return [
      createButton({ className: "mermaid-btn-zoomin", title: "Zoom In", textContent: "+" }),
      createButton({ className: "mermaid-btn-zoomout", title: "Zoom Out", textContent: "−" }),
      createButton({ className: "mermaid-btn-reset", title: "Reset View", textContent: "Reset" }),
      createButton({
        className: "mermaid-btn-maximize",
        title: "Full Screen",
        innerHTML: maximizeIcon,
        ariaPressed: "false",
      }),
    ]
      .map((btn) => btn.outerHTML)
      .join("\n");
  }

  function buildControls(block) {
    const controls = document.createElement("div");
    controls.className = "mermaid-controls";
    controls.innerHTML = getButtons(MAXIMIZE_ICON);
    block.insertBefore(controls, block.firstChild);
    return controls;
  }

  // ── Full-screen (maximize) support ───────────────────────────────────
  // Re-fit the pan/zoom instance after the block's size changes. Two rAFs so
  // the fixed full-screen layout is committed before we read dimensions —
  // otherwise fit()/center() measure the old size and the diagram lands off-centre.
  function fitMaximizedPanZoom(block) {
    const pz = block && block._mermaidPanZoom;
    if (!pz) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // Guard: if the block is momentarily zero-size (mid layout/collapse),
        // svg-pan-zoom's fit() builds a non-invertible matrix and throws.
        try {
          pz.resize();
          pz.fit();
          pz.center();
          limitZoomOut(pz);
        } catch (e) {
          /* transient degenerate size — ignore */
        }
      }),
    );
  }

  function setMaximized(block, on) {
    block.classList.toggle("_maximized", on);
    document.body.classList.toggle("mermaid-maximized-open", on);
    const btn = block.querySelector(".mermaid-btn-maximize");
    if (btn) {
      btn.classList.toggle("_active", on);
      btn.title = on ? "Exit full screen (Esc)" : "Full screen";
      btn.setAttribute("aria-pressed", String(on));
    }
    fitMaximizedPanZoom(block);
  }

  // Escape exits full screen for whichever diagram is maximized.
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const maxed = document.querySelector(".mermaid-block._maximized");
    if (maxed) setMaximized(maxed, false);
  });

  // Mermaid paints layers bottom-to-top as clusters → edgePaths → nodes, so a
  // long edge that routes behind a node box is hidden by it (dagre threads many
  // cross-subgraph links under other boxes). Re-stack the edge layers above the
  // nodes so every connector — and its label — stays fully visible.
  function raiseEdgesAboveNodes(svgEl) {
    const nodes = svgEl.querySelector("g.nodes");
    if (!nodes) return;

    const parent = nodes.parentNode;
    for (const cls of ["edgePaths", "edgeLabels"]) {
      const layer = [...parent.children].find((c) => c.getAttribute("class") === cls);
      if (layer) parent.appendChild(layer);
    }
  }

  const nextFrame = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function hasSize(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ── Pan/zoom + control wiring ────────────────────────────────────────
  async function initInteractions(el, block) {
    const svgEl = el.querySelector("svg");
    if (!svgEl) return;

    svgEl.style.width = "100%";
    svgEl.style.height = "100%";
    svgEl.removeAttribute("height");

    // Capture the diagram's natural aspect ratio before svg-pan-zoom strips the
    // viewBox. The stylesheet uses it to size the container to the diagram's
    // shape (short LR charts stay short) instead of a fixed tall box.
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
      block.style.setProperty("--mermaid-aspect", vb.width + " / " + vb.height);
    }

    if (!cfg.panZoom || !window.svgPanZoom) return;

    // The svg was just moved into the visible DOM; svg-pan-zoom's initial fit
    // needs it to have real layout. Initializing against a zero-size svg builds
    // a non-invertible matrix ("matrix is not invertible") and leaves the
    // diagram broken. Wait for a laid-out, non-zero box first.
    for (let i = 0; i < 10 && !hasSize(svgEl); i++) {
      await nextFrame();
    }
    if (!hasSize(svgEl)) return; // pan/zoom unavailable, but the static svg shows

    let panZoomInstance;
    try {
      panZoomInstance = window.svgPanZoom(svgEl, {
        zoomEnabled: true,
        controlIconsEnabled: false,
        fit: true,
        center: true,
        minZoom: cfg.minZoom,
        maxZoom: cfg.maxZoom,
        zoomScaleSensitivity: 0.3,
      });
    } catch (e) {
      console.warn("[Mermaid] pan/zoom init failed; showing static diagram", e);
      return;
    }
    block._mermaidPanZoom = panZoomInstance;
    limitZoomOut(panZoomInstance);

    const controls = buildControls(block);
    controls.querySelector(".mermaid-btn-reset").addEventListener("click", () => {
      panZoomInstance.resetZoom();
      panZoomInstance.center();
    });
    controls
      .querySelector(".mermaid-btn-zoomin")
      .addEventListener("click", () => panZoomInstance.zoomIn());
    controls
      .querySelector(".mermaid-btn-zoomout")
      .addEventListener("click", () => panZoomInstance.zoomOut());
    controls
      .querySelector(".mermaid-btn-maximize")
      .addEventListener("click", () =>
        setMaximized(block, !block.classList.contains("_maximized")),
      );

    const ro = new ResizeObserver(() => {
      // Skip while the element is zero-size (collapsed nav, mid-transition) —
      // fit() would throw on a non-invertible matrix.
      if (!hasSize(el)) return;
      try {
        panZoomInstance.resize();
        panZoomInstance.fit();
        panZoomInstance.center();
        limitZoomOut(panZoomInstance);
      } catch (e) {
        /* transient degenerate size — ignore */
      }
    });
    ro.observe(el);
  }

  // ── Rendering ────────────────────────────────────────────────────────
  let mermaid;

  // When text metrics come back as 0 (cold layout), mermaid doesn't throw — it
  // "succeeds" with a collapsed diagram (viewBox around 16×16). Detect that so
  // the render is retried instead of committed as a broken 16px graph.
  const MIN_VIEWBOX = 30;

  function assertNonDegenerate(svgString) {
    const m = /viewBox="\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*"/.exec(svgString);
    if (!m) return;
    const w = Number(m[3]);
    const h = Number(m[4]);
    if (w < MIN_VIEWBOX || h < MIN_VIEWBOX) {
      throw new Error("degenerate render (viewBox " + w + "×" + h + " — text measured as 0)");
    }
  }

  // Off-screen container for mermaid to render in. Avoids layout issues caused
  // by theme CSS constraining the content area. It is positioned off-screen but
  // NOT visibility:hidden — a hidden subtree can make Chrome report zero-size
  // SVG text metrics, which breaks dagre edge routing ("Could not find a
  // suitable point for the given distance") until DevTools is opened.
  const offscreen = document.createElement("div");
  offscreen.setAttribute("aria-hidden", "true");
  Object.assign(offscreen.style, {
    position: "fixed",
    left: "-9999px",
    top: "-9999px",
    width: "4000px",
    height: "4000px",
    pointerEvents: "none",
  });

  document.body.appendChild(offscreen);

  // Wait for the browser to commit a layout pass. Mermaid measures node/text
  // geometry synchronously; if the offscreen container hasn't been laid out yet,
  // measurements come back 0 and edge routing throws "Could not find a suitable
  // point for the given distance". Two rAFs guarantee we're past a committed
  // layout+paint, and reading offsetHeight forces a synchronous reflow.
  async function waitForLayout() {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    void offscreen.offsetHeight;
  }

  async function renderOneDiagram(el, code, maxRetries = 5) {
    const diagramLabel = code.substring(0, 60).replace(/\n/g, " ").trim() + "...";
    console.log(
      "%c[Mermaid] Starting render for: " + diagramLabel,
      "color: #2196F3; font-weight: bold",
    );
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const id = "mermaid-" + Math.random().toString(36).slice(2, 10);
      const t0 = performance.now();
      try {
        if (attempt > 1) {
          // Back off with real wall-clock time so whatever hasn't settled
          // (layout, fonts) gets a chance to before we re-measure. Without a
          // delay all retries hit the same un-settled state and fail together.
          await sleep(attempt * 120);
          console.log(
            "%c[Mermaid] Attempt " + attempt + "/" + maxRetries + " (re-initializing...)",
            "color: #FF9800",
          );
          mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
        } else {
          console.log("%c[Mermaid] Attempt " + attempt + "/" + maxRetries, "color: #607D8B");
        }
        await waitForLayout();
        const { svg } = await mermaid.render(id, code, offscreen);
        assertNonDegenerate(svg);
        const elapsed = (performance.now() - t0).toFixed(1);
        console.log(
          "%c[Mermaid] ✓ Rendered successfully on attempt " + attempt + " (" + elapsed + "ms)",
          "color: #4CAF50; font-weight: bold",
        );
        el.innerHTML = svg;
        const svgEl = el.querySelector("svg");
        if (svgEl) raiseEdgesAboveNodes(svgEl);
        await initInteractions(el, el.closest(".mermaid-block"));
        return;
      } catch (e) {
        const elapsed = (performance.now() - t0).toFixed(1);
        console.warn(
          "%c[Mermaid] ✗ Attempt " +
            attempt +
            "/" +
            maxRetries +
            " failed (" +
            elapsed +
            "ms): " +
            e.message,
          "color: #F44336; font-weight: bold",
        );
        const stale = offscreen.querySelector("#d" + id);
        if (stale) stale.remove();
        if (attempt === maxRetries) {
          console.error(
            "%c[Mermaid] ✗ All " + maxRetries + " attempts failed — refresh the page to retry",
            "color: #F44336; font-weight: bold",
          );
          el.innerHTML =
            "<pre style='color:red'>Diagram failed to render. Please refresh the page.</pre>";
        }
      }
    }
  }

  async function renderDiagrams() {
    const elements = document.querySelectorAll(".mermaid-block .mermaid");
    console.log(
      "%c[Mermaid] Found " + elements.length + " diagram(s) to render",
      "color: #2196F3; font-weight: bold",
    );
    const t0 = performance.now();
    for (const el of elements) {
      await renderOneDiagram(el, el.textContent);
    }
    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(
      "%c[Mermaid] All diagrams processed in " + elapsed + "ms",
      "color: #2196F3; font-weight: bold",
    );
  }

  // Register the ELK layout engine so diagrams with `layout: elk` in their
  // frontmatter route the way they do in the VS Code / mermaid.live previews.
  // ELK ships as a separate package (not in mermaid's core CDN bundle); without
  // this, `layout: elk` silently falls back to dagre and looks different.
  async function registerElkLayout() {
    if (typeof mermaid.registerLayoutLoaders !== "function") return;
    try {
      const elk = await import(
        "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs"
      );
      mermaid.registerLayoutLoaders(elk.default);
    } catch (e) {
      console.warn("[Mermaid] ELK layout failed to load; 'layout: elk' falls back to dagre", e);
    }
  }

  // Mermaid runs one-time lazy setup on its first render(), so the first real
  // diagram is the one most likely to hit the cold-start layout race. Absorb
  // that cost on a throwaway diagram first; failures here are ignored since the
  // real renders retry on their own.
  async function warmUpMermaid() {
    try {
      await waitForLayout();
      await mermaid.render("mermaid-warmup", "flowchart LR\n  A --> B", offscreen);
    } catch (e) {
      /* warm-up only */
    }
  }

  // Wait for fonts to load before rendering — dagre measures text via getBBox()
  // and wrong font metrics cause "Could not find a suitable point" layout errors.
  async function waitForFonts() {
    if (!document.fonts || !document.fonts.ready) return;
    // Explicitly request mermaid's default font stack. document.fonts.ready
    // only waits on fonts already requested; the offscreen container hasn't
    // rendered yet, so without this the promise can resolve before the fonts
    // mermaid measures against are available.
    try {
      await Promise.all([
        document.fonts.load('16px "trebuchet ms"'),
        document.fonts.load("16px verdana"),
        document.fonts.load("16px arial"),
      ]);
    } catch (e) {
      /* system fonts — load() may reject, harmless */
    }
    await document.fonts.ready;
    console.log("%c[Mermaid] Fonts loaded, starting render", "color: #2196F3");
  }

  async function main() {
    if (document.readyState === "loading") {
      await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve));
    }

    const mod = await import(
      "https://cdn.jsdelivr.net/npm/mermaid@" + cfg.version + "/dist/mermaid.esm.min.mjs"
    );
    mermaid = mod.default;
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
    await registerElkLayout();

    if (cfg.panZoom) {
      try {
        await loadScript(
          "https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.2/dist/svg-pan-zoom.min.js",
        );
      } catch (e) {
        console.warn("[Mermaid] svg-pan-zoom failed to load; diagrams render without pan/zoom", e);
      }
    }

    await waitForFonts();
    await warmUpMermaid();
    await renderDiagrams();
  }

  void main();
})();
