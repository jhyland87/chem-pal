/*
 * Minimal YAML frontmatter parser for the mermaid plugin runtime.
 *
 * Loaded as its own classic <script> tag immediately before mermaid-diagrams.js
 * and exposes a single global — window.MermaidFrontmatter — so the runtime can
 * read a diagram's `---\nconfig: ...\n---` block. Kept dependency-free to
 * preserve the plugin's zero-npm-dependency promise, and split into its own file
 * purely for readability.
 */
(function () {
  "use strict";

  function parseFrontmatter(str) {
    const match = str.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { data: {}, content: str };
    return {
      data: parseYaml(match[1]),
      content: str.slice(match[0].length).replace(/^\r?\n/, ""),
    };
  }

  function parseYaml(text) {
    const lines = text
      .split(/\r?\n/)
      .map(stripComment)
      .filter((l) => l.trim() !== "")
      .map((l) => ({
        indent: l.length - l.trimStart().length,
        text: l.trim(),
      }));

    let i = 0;

    function parseNode(indent) {
      if (i >= lines.length) return null;
      return lines[i].text.startsWith("- ") ? parseList(indent) : parseMap(indent);
    }

    function parseMap(indent) {
      const obj = {};
      while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith("- ")) {
        const { text } = lines[i];
        const c = findColon(text);
        const key = unquote(text.slice(0, c).trim());
        const rest = text.slice(c + 1).trim();
        i++;
        if (rest === "") {
          obj[key] =
            i < lines.length && lines[i].indent > indent ? parseNode(lines[i].indent) : null;
        } else {
          obj[key] = parseScalar(rest);
        }
      }
      return obj;
    }

    function parseList(indent) {
      const arr = [];
      while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith("- ")) {
        const item = lines[i].text.slice(2).trim();
        if (item === "") {
          i++;
          arr.push(i < lines.length && lines[i].indent > indent ? parseNode(lines[i].indent) : null);
        } else if (findColon(item) !== -1) {
          // list item that is itself a map: "- key: value"
          lines[i] = { indent: indent + 2, text: item };
          arr.push(parseMap(indent + 2));
        } else {
          arr.push(parseScalar(item));
          i++;
        }
      }
      return arr;
    }

    return parseNode(lines.length ? lines[0].indent : 0);
  }

  // --- helpers ---

  function stripComment(line) {
    let inS = false,
      inD = false;
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (c === "'" && !inD) inS = !inS;
      else if (c === '"' && !inS) inD = !inD;
      else if (c === "#" && !inS && !inD && (k === 0 || line[k - 1] === " ")) {
        return line.slice(0, k);
      }
    }
    return line;
  }

  function findColon(text) {
    let inS = false,
      inD = false;
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (c === "'" && !inD) inS = !inS;
      else if (c === '"' && !inS) inD = !inD;
      else if (c === ":" && !inS && !inD && (k + 1 >= text.length || text[k + 1] === " ")) {
        return k;
      }
    }
    return -1;
  }

  function unquote(v) {
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function parseScalar(v) {
    if (v === "" || v === "null" || v === "~") return null;
    if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    if (v[0] === "[" && v.endsWith("]")) {
      const inner = v.slice(1, -1).trim();
      return inner === "" ? [] : splitFlow(inner).map((s) => parseScalar(s.trim()));
    }
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
    return v;
  }

  function splitFlow(s) {
    const out = [];
    let depth = 0,
      inS = false,
      inD = false,
      start = 0;
    for (let k = 0; k < s.length; k++) {
      const c = s[k];
      if (c === "'" && !inD) inS = !inS;
      else if (c === '"' && !inS) {
        inD = !inD;
      } else if (!inS && !inD) {
        if (c === "[" || c === "{") depth++;
        else if (c === "]" || c === "}") depth--;
        else if (c === "," && depth === 0) {
          out.push(s.slice(start, k));
          start = k + 1;
        }
      }
    }
    out.push(s.slice(start));
    return out;
  }

  window.MermaidFrontmatter = { parseFrontmatter };
})();
