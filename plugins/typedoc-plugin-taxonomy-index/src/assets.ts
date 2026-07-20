/**
 * Stylesheet for the taxonomy pages, written to `assets/taxonomy.css` at render
 * time and linked from the document head.
 *
 * Inlined as a string rather than shipped as a `.css` file so a plain `tsc` build
 * produces a complete `dist/` with no asset-copy step. Colours come from
 * TypeDoc's own custom properties so the pages track light/dark and any custom
 * theme automatically.
 * @source
 */
export const TAXONOMY_CSS = `
.tsd-taxonomy-lead {
  color: var(--color-text-aside);
  margin-top: 0;
}

.tsd-taxonomy-breadcrumb {
  color: var(--color-text-aside);
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.tsd-taxonomy-section > h2,
.tsd-taxonomy-module > h2 {
  align-items: baseline;
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
}

.tsd-taxonomy-section-meta {
  color: var(--color-text-aside);
  font-size: 0.8rem;
  font-weight: normal;
}

.tsd-taxonomy-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
}

.tsd-taxonomy-card {
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-accent);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}

.tsd-taxonomy-card-title {
  align-items: baseline;
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  margin: 0 0 0.25rem;
}

.tsd-taxonomy-card-owners {
  color: var(--color-text-aside);
  font-size: 0.75rem;
  margin: 0 0 0.5rem;
}

.tsd-taxonomy-count {
  background-color: var(--color-accent);
  border-radius: 999px;
  color: var(--color-text);
  font-size: 0.75rem;
  font-weight: normal;
  padding: 0.1rem 0.5rem;
}

.tsd-taxonomy-preview {
  color: var(--color-text-aside);
  font-size: 0.8rem;
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
}

.tsd-taxonomy-preview > li {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tsd-taxonomy-preview-more {
  font-style: italic;
}

.tsd-taxonomy-members {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tsd-taxonomy-member {
  border-bottom: 1px solid var(--color-accent);
  padding: 0.4rem 0;
}

.tsd-taxonomy-member:last-child {
  border-bottom: none;
}

.tsd-taxonomy-member-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tsd-taxonomy-member-name {
  font-family: var(--font-family-code, monospace);
}

.tsd-taxonomy-member-parent {
  color: var(--color-text-aside);
  font-size: 0.75rem;
}

.tsd-taxonomy-member-summary {
  color: var(--color-text-aside);
  display: block;
  font-size: 0.85rem;
}

.tsd-taxonomy-member-summary p {
  margin: 0.15rem 0 0;
}
`;
