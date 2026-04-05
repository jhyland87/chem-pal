import type { Extracted, Ctx } from './types';
import { compress } from './lz-string';
import { generateFingerprint } from './fingerprint';
import { deobfuscateAndExtract } from './deobf';

export type Fingerprint = Record<string, string[]>;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const SCRIPT_HEADERS: HeadersInit = {
  'sec-ch-ua-platform': '"Windows"',
  'user-agent': USER_AGENT,
  'sec-ch-ua':
    '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  accept: '*/*',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-dest': 'script',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
};

const SUBMIT_HEADERS: HeadersInit = {
  'sec-ch-ua-platform': '"Windows"',
  'user-agent': USER_AGENT,
  'sec-ch-ua':
    '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'content-type': 'text/plain;charset=UTF-8',
  'sec-ch-ua-mobile': '?0',
  accept: '*/*',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  priority: 'u=1, i',
};

function decodeTimestamp(t: string): number {
  const decoded = atob(t);
  return parseInt(decoded, 10);
}

function currentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function resolveFingerprint(fp: Fingerprint): Fingerprint {
  if (!('%timestamp%' in fp)) return fp;
  const resolved = { ...fp };
  const value = resolved['%timestamp%'];
  delete resolved['%timestamp%'];
  resolved[currentTimestamp()] = value;
  return resolved;
}

export class JsdSolver {
  private host: string;
  private uri: string;
  private ext: Extracted;
  private ctx: Ctx | null = null;
  private fetchFn: typeof fetch;
  private fingerprint: Fingerprint | null;

  /**
   * @param host - Target hostname (e.g. "www.bstn.com")
   * @param uri - Full page URL (e.g. "https://www.bstn.com/eu_de")
   * @param ext - Extracted r/t values from the page HTML
   * @param fingerprint - Browser fingerprint from get_fingerprint.js (console output parsed as JSON).
   *                      If null, falls back to a static Chrome 143 fingerprint.
   * @param fetchFn - Custom fetch implementation (defaults to global fetch)
   */
  constructor(
    host: string,
    uri: string,
    ext: Extracted,
    fingerprint: Fingerprint | null = null,
    fetchFn: typeof fetch = fetch,
  ) {
    this.host = host.replace(/\/$/, '');
    this.uri = uri;
    this.ext = ext;
    this.fingerprint = fingerprint;
    this.fetchFn = fetchFn;
  }

  async fetchScript(): Promise<string> {
    const url = `https://${this.host}/cdn-cgi/challenge-platform/scripts/jsd/main.js`;
    const resp = await this.fetchFn(url, { headers: SCRIPT_HEADERS });

    if (!resp.ok) {
      throw new Error(`Failed to fetch script: ${resp.status}`);
    }

    return resp.text();
  }

  async submit(): Promise<Response> {
    if (!this.ctx) {
      throw new Error('Must call run() before submit()');
    }

    const payload: Record<string, unknown> = {
      t: decodeTimestamp(this.ext.t),
      lhr: 'about:blank',
      api: false,
      payload: this.fingerprint
        ? resolveFingerprint(this.fingerprint)
        : generateFingerprint(this.host, this.uri),
    };

    const json = JSON.stringify(payload);
    const compressed = compress(json, this.ctx.alphabet);

    const endpoint = `https://${this.host}/cdn-cgi/challenge-platform/h/${this.ctx.ve}/jsd/oneshot${this.ctx.path}${this.ext.r}`;

    const resp = await this.fetchFn(endpoint, {
      method: 'POST',
      headers: {
        ...SUBMIT_HEADERS,
        origin: `https://${this.host}`,
      },
      body: compressed,
    });

    return resp;
  }

  async run(): Promise<Response> {
    const script = await this.fetchScript();
    this.ctx = deobfuscateAndExtract(script);
    return this.submit();
  }
}
