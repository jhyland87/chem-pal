/***
 * Convert a string to kebab case.
 * @example
 * kebabize("HelloWorld") // "hello-world"
 * @param {string} str
 * @returns {string}
 */
export const kebabize = (str) =>
  str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());

/**
 * Escape HTML characters in a string.
 * @example
 * escapeHtml("Hello <World>") // "Hello &lt;World&gt;"
 * @param {string} content
 * @returns {string}
 */
export const escapeHtml = (content) =>
  content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
