/**
 * Injects PostHog chunk-id comments into a built extension bundle and uploads
 * the matching source maps, then deletes the local .map files so they never
 * ship inside the packaged .crx/.zip.
 *
 * Usage: node tools/uploadSourceMaps.js --dir build
 *        node tools/uploadSourceMaps.js --dir build-firefox
 *
 * No-ops (exit 0) when POSTHOG_PERSONAL_API_KEY isn't set — every non-release
 * build (local dev, PR checks, e2e) skips this entirely, since vite.config.ts
 * only turns sourcemaps on in prod when that same variable is set. When the
 * key IS set but the upload fails (bad key, wrong project id, a PostHog
 * outage), this warns and still exits 0: a broken observability integration
 * must never block shipping the extension. The .map files are removed either
 * way, so a failed upload can't leave raw source in the shipped package.
 *
 * Deliberately not a Vite/Rollup plugin (posthog-cli is invoked directly
 * instead): @posthog/rollup-plugin's hooks throw on failure, which would fail
 * `vite build` itself and, since build:prod chains straight into
 * tools/pack-extension.js, take the whole release down with it. Running this
 * as its own step after the build (and before packing) keeps a PostHog
 * failure from ever touching the actual build/pack steps.
 *
 * Requires:
 *   - ./<dir>/assets/   (run `vite build --mode=production` first)
 *   - @posthog/cli, installed as a devDependency
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { _g, _r, _realpath, _y, getPluginVersion } from "./helpers.js";

const dirFlagIndex = process.argv.indexOf("--dir");
const buildDir = dirFlagIndex === -1 ? "build" : process.argv[dirFlagIndex + 1];
const assetsDir = _realpath(`${buildDir}/assets`);

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
if (!apiKey) {
  console.log(`Skipping source map upload for ${buildDir}/ — POSTHOG_PERSONAL_API_KEY not set.`);
  process.exit(0);
}

if (!existsSync(assetsDir)) {
  console.error(_r(`❌ ${assetsDir} not found. Run the production build first.`));
  process.exit(1);
}

const releaseName = `chempal@${getPluginVersion()}`;
const env = {
  ...process.env,
  POSTHOG_CLI_API_KEY: apiKey,
  ...(process.env.POSTHOG_PROJECT_ID ? { POSTHOG_CLI_PROJECT_ID: process.env.POSTHOG_PROJECT_ID } : {}),
  ...(process.env.POSTHOG_HOST ? { POSTHOG_CLI_HOST: process.env.POSTHOG_HOST } : {}),
};

/**
 * Removes every .map file from the assets directory, so neither a failed nor
 * a successful upload attempt leaves raw source maps for
 * tools/pack-extension.js / tools/pack-firefox.js to bundle into the shipped
 * package.
 */
function deleteSourceMaps() {
  for (const file of readdirSync(assetsDir)) {
    if (file.endsWith(".map")) rmSync(_realpath(`${buildDir}/assets/${file}`));
  }
}

try {
  execFileSync("pnpm", ["exec", "posthog-cli", "sourcemap", "inject", "--directory", assetsDir], {
    stdio: "inherit",
    env,
  });
  execFileSync(
    "pnpm",
    [
      "exec",
      "posthog-cli",
      "sourcemap",
      "upload",
      "--directory",
      assetsDir,
      "--release-name",
      releaseName,
      "--release-version",
      getPluginVersion(),
    ],
    { stdio: "inherit", env },
  );
  console.log(_g(`✅ Uploaded source maps for ${buildDir}/ (release ${releaseName})`));
} catch (error) {
  console.warn(_y(`⚠️  Source map upload failed for ${buildDir}/ — continuing without it.`));
  console.warn(_y(String(error?.message ?? error)));
} finally {
  deleteSourceMaps();
}
