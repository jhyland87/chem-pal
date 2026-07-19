import { execSync } from "node:child_process";
import path from "node:path";
import { firefox, type Browser } from "playwright";
import {
  connectWithMaxRetries,
  findFreeTcpPort,
  type RemoteFirefox,
} from "playwright-webextext/dist/firefox_remote.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const buildDir = path.resolve(__dirname, "..", "build-firefox");

// Must match `browser_specific_settings.gecko.id` in the Firefox manifest
// (see tools/buildManifest.js).
const GECKO_ID = "chem-pal@jhyland87";

// Pin the add-on's internal moz-extension UUID so we can assert the URL it
// registers under is deterministic.
const EXT_UUID = "8b3c2d4e-1f5a-4b6c-8d7e-9a0b1c2d3e4f";

/**
 * Shape of a temporary-add-on descriptor returned by the Firefox remote
 * debugging protocol's `listAddons`. playwright-webextext types this narrowly
 * ({ id, actor }), but the real payload carries the fields we assert on.
 */
interface FirefoxAddonDescriptor {
  id: string;
  isWebExtension?: boolean;
  temporarilyInstalled?: boolean;
  backgroundScriptStatus?: string;
  manifestURL?: string;
  warnings?: string[];
}

/**
 * Firefox can't have its extension UI driven via Playwright's `page.goto`
 * (microsoft/playwright#3792), so instead of replaying the Chrome UI suite we
 * verify the Firefox build actually loads and runs in real Firefox: it installs
 * as a temporary add-on, registers under the expected origin, and its
 * background script reaches RUNNING. Functional UI behaviour is covered by the
 * Chrome E2E suite, which runs the same `index.html` bundle.
 */
describe("Chem-Pal Firefox extension load (smoke)", () => {
  let browser: Browser;
  let client: RemoteFirefox;
  let addon: FirefoxAddonDescriptor | undefined;

  beforeAll(async () => {
    // Build the Firefox extension (standard mode, not aggregate).
    execSync("pnpm build:e2e:firefox", {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
    });

    const port = await findFreeTcpPort();
    browser = await firefox.launch({
      headless: true,
      args: ["--start-debugger-server", String(port)],
      firefoxUserPrefs: {
        "devtools.debugger.remote-enabled": true,
        "devtools.debugger.prompt-connection": false,
        "extensions.manifestV3.enabled": true,
        "extensions.webextensions.uuids": JSON.stringify({ [GECKO_ID]: EXT_UUID }),
      },
    });

    client = await connectWithMaxRetries({ port, maxRetries: 20, retryInterval: 500 });
    await client.installTemporaryAddon(buildDir);

    const response = (await client.client.request("listAddons")) as unknown as {
      addons: FirefoxAddonDescriptor[];
    };
    addon = response.addons.find((entry) => entry.id === GECKO_ID);
  }, 120_000);

  afterAll(async () => {
    client?.disconnect();
    await browser?.close();
  });

  it("installs the unpacked Firefox build as a temporary add-on", () => {
    expect(addon).toBeDefined();
    expect(addon?.isWebExtension).toBe(true);
    expect(addon?.temporarilyInstalled).toBe(true);
  });

  it("registers under the pinned moz-extension UUID", () => {
    expect(addon?.manifestURL).toBe(`moz-extension://${EXT_UUID}/manifest.json`);
  });

  it("runs the background script", () => {
    expect(addon?.backgroundScriptStatus).toBe("RUNNING");
  });

  it("loads with no blocking manifest warnings", () => {
    // `version_name` is Chrome-only; Firefox warns on it harmlessly. Any other
    // warning would point at a real manifest incompatibility.
    const warnings = (addon?.warnings ?? []).filter((w) => !/version_name/i.test(w));
    expect(warnings).toEqual([]);
  });
});
