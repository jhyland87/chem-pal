import type { Extracted } from './types';

const RT_RE = /r:'([^']+)',t:'([^']+)'/;

export function extractRT(html: string): Extracted | null {
  const m = RT_RE.exec(html);
  if (m && m.length === 3) {
    return { r: m[1], t: m[2] };
  }
  return null;
}
