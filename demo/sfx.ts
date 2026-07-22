/**
 * Sound effects for the demo recording.
 *
 * Playwright records a silent screencast, so click/keyboard sounds can't be
 * captured live. Instead we listen for real `mousedown`/`keydown` events in the
 * page (via an init script + an exposed binding, so the demo scripts need no
 * changes) and timestamp each relative to the recording start. After the video
 * is flushed, ffmpeg overlays the real sound files (`demo/assets/*.mp3`) onto
 * the `.webm` and writes an `.mp4`:
 *   - the mouse-click sound plays once at each click;
 *   - the typing sound (a single long recording) is started at each typing run
 *     and cut to that run's length — never stretched or looped;
 *   - the scroll sound plays for each scroll run (smooth scrolls), likewise cut
 *     to the run's length.
 * Finally {@link addIntroOutro} wraps the result with a white ChemPal-logo card
 * that crossfades into the demo at the start and back out at the end.
 * Every step degrades gracefully — a missing ffmpeg, missing sound files, no
 * events, or a mux error only logs a warning and never fails the demo.
 *
 * @module demo/sfx
 */
import { type BrowserContext } from '@playwright/test';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Sound played once per mouse click. */
const CLICK_SOUND = path.resolve(moduleDir, 'assets', 'mouse-click-sound.mp3');
/** Long typing recording; a leading slice is played for each typing run. */
const TYPING_SOUND = path.resolve(moduleDir, 'assets', 'typing-sound.mp3');
/** Short mouse-wheel recording; a leading slice is played for each scroll run. */
const SCROLL_SOUND = path.resolve(moduleDir, 'assets', 'scroll-sound.mp3');

/** Loudness multipliers per sound (1 = unchanged); tune to taste. */
const CLICK_VOLUME = 1;
const TYPING_VOLUME = 1;
const SCROLL_VOLUME = 1;

/**
 * Constant offset (ms) applied to every event before placing its sound, to
 * align the audio with the recorded video. Nudge this by eye if sounds land
 * slightly early (negative) or late (positive); slowMo and recorder start-up
 * jitter make perfect sync impossible, but a demo only needs it close.
 */
const SFX_SYNC_OFFSET_MS = 0;

/**
 * Extra delay (ms) applied to click sounds only, so the click lands once the
 * gliding on-screen pointer has reached the click point rather than a beat
 * before it. Kept in step with the ripple delay (`RIPPLE_DELAY_MS` in
 * `cursor.ts`) so the sound and the ripple appear together, on the pointer.
 */
const CLICK_LAG_MS = 190;

/** Keystrokes more than this far apart start a new typing run. */
const TYPING_GAP_MS = 500;
/** Extra time added past the last keystroke of a run so it doesn't cut abruptly. */
const TYPING_TAIL_MS = 250;
/** Floor for a run's length so a single keystroke still plays something. */
const TYPING_MIN_MS = 250;
/**
 * Strips leading near-silence from a sound before it's placed, so it starts on
 * the event (the click transient / first keystroke lands on time), then resets
 * timestamps so any subsequent trim measures from that first audible sample.
 * Applied to the click and typing sounds; the scroll clip is already tight.
 */
const LEADIN_TRIM =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_duration=0,asetpts=PTS-STARTPTS';

/** Scroll events more than this far apart start a new scroll run. */
const SCROLL_GAP_MS = 350;
/** Extra time added past the last scroll event of a run so it doesn't cut abruptly. */
const SCROLL_TAIL_MS = 120;
/** Minimum span for a scroll run to play a sound — filters out instant `scrollIntoView` blips. */
const SCROLL_MIN_SPAN_MS = 250;

/** Intro/outro card logo (centered on a white background). */
const CARD_LOGO = path.resolve(
  moduleDir,
  '..',
  'public',
  'static',
  'images',
  'logo',
  'ChemPal-logo.png',
);
/** Seconds the intro/outro card is shown (including the crossfade). */
const INTRO_SEC = 2;
const OUTRO_SEC = 2;
/** Crossfade duration (s) between the card and the demo. */
const XFADE_SEC = 0.8;

/** The name of the page binding the init script calls to report an event. */
const BINDING_NAME = '__chempalSfxRecord';

/** The kinds of interaction we play a sound for. */
type SfxKind = 'click' | 'key' | 'scroll';

/** A single interaction, timestamped relative to the recording start. */
interface SfxEvent {
  kind: SfxKind;
  atMs: number;
}

/** A contiguous run (typing or scrolling): when it starts and how long to play the sound. */
interface SoundRun {
  startMs: number;
  durMs: number;
}

/** Wall-clock time (ms) the current recording started; set by {@link startSfxTimeline}. */
let videoStartMs = 0;

/** Events collected for the current recording. */
const events: SfxEvent[] = [];

/**
 * Marks the start of a recording: stamps the reference time and clears any
 * events from a previous run. Call right after the browser context (and its
 * video) is created.
 * @returns Nothing; resets module state as a side effect.
 * @example
 * startSfxTimeline(); // subsequent clicks/keystrokes are timed from here
 * @source
 */
export function startSfxTimeline(): void {
  videoStartMs = Date.now();
  events.length = 0;
}

/**
 * Records one interaction at the current offset into the recording. Unknown
 * kinds are ignored. Called by the page binding, not directly.
 * @param kind - The interaction kind reported by the page (`"click"` | `"key"` | `"scroll"`).
 * @returns Nothing; appends to the event list as a side effect.
 * @example
 * recordSfxEvent("click"); // pushes { kind: "click", atMs: <now - start> }
 * @source
 */
export function recordSfxEvent(kind: string): void {
  if (kind !== 'click' && kind !== 'key' && kind !== 'scroll') {
    return;
  }
  events.push({ kind, atMs: Date.now() - videoStartMs });
}

/**
 * Installs the page-side capture: exposes a binding and injects an init script
 * that forwards every `mousedown` (as a click) and every character `keydown`
 * (as a key — Enter/Tab/arrows/modifiers are ignored) to {@link recordSfxEvent}.
 * Runs for every page/frame in the context, so the demo scripts don't need to
 * be instrumented. Call before any navigation.
 * @param context - The browser context to instrument.
 * @returns Resolves once the binding and init script are registered.
 * @example
 * await installSfxCapture(context);
 * @source
 */
export async function installSfxCapture(context: BrowserContext): Promise<void> {
  await context.exposeBinding(BINDING_NAME, (_source, kind: string) => {
    recordSfxEvent(kind);
  });
  await context.addInitScript((bindingName: string) => {
    const record = (kind: string): void => {
      const fn = Reflect.get(window, bindingName);
      if (typeof fn === 'function') {
        fn(kind);
      }
    };
    window.addEventListener('mousedown', () => record('click'), true);
    window.addEventListener(
      'keydown',
      (event) => {
        // Only actual character input drives the typing sound.
        if (!event.repeat && event.key.length === 1) {
          record('key');
        }
      },
      true,
    );
    // Throttle scroll: a smooth scroll fires ~60 events/s; one sample per 50ms
    // is plenty to bound the run and keeps the page↔Node binding traffic light.
    let lastScrollAt = 0;
    window.addEventListener(
      'scroll',
      () => {
        const now = performance.now();
        if (now - lastScrollAt > 50) {
          lastScrollAt = now;
          record('scroll');
        }
      },
      true,
    );
  }, BINDING_NAME);
}

/**
 * Groups keystroke timestamps into contiguous typing runs. A gap longer than
 * {@link TYPING_GAP_MS} starts a new run; each run's sound length is its span
 * plus a short tail, floored at {@link TYPING_MIN_MS}.
 * @param keyTimesMs - Keystroke offsets (ms from recording start), any order.
 * @returns The typing runs, each with a start offset and a play duration.
 * @example
 * toTypingRuns([100, 170, 240, 5000]);
 * // => [{ startMs: 100, durMs: 390 }, { startMs: 5000, durMs: 250 }]
 * @source
 */
function toTypingRuns(keyTimesMs: number[]): SoundRun[] {
  const sorted = [...keyTimesMs].sort((a, b) => a - b);
  const runs: SoundRun[] = [];
  let start: number | undefined;
  let last = 0;
  for (const t of sorted) {
    if (start === undefined) {
      start = t;
      last = t;
    } else if (t - last > TYPING_GAP_MS) {
      runs.push({ startMs: start, durMs: Math.max(TYPING_MIN_MS, last - start + TYPING_TAIL_MS) });
      start = t;
      last = t;
    } else {
      last = t;
    }
  }
  if (start !== undefined) {
    runs.push({ startMs: start, durMs: Math.max(TYPING_MIN_MS, last - start + TYPING_TAIL_MS) });
  }
  return runs;
}

/**
 * Groups scroll timestamps into contiguous scroll runs, dropping any run shorter
 * than {@link SCROLL_MIN_SPAN_MS} (instant `scrollIntoView` blips). A gap longer
 * than {@link SCROLL_GAP_MS} starts a new run; each kept run's length is its span
 * plus a short tail.
 * @param scrollTimesMs - Scroll offsets (ms from recording start), any order.
 * @returns The scroll runs long enough to sound, each with a start and duration.
 * @example
 * toScrollRuns([100, 150, 900, 6000]); // => one run ~[100..900]; the lone 6000 is dropped
 * @source
 */
function toScrollRuns(scrollTimesMs: number[]): SoundRun[] {
  const sorted = [...scrollTimesMs].sort((a, b) => a - b);
  const runs: SoundRun[] = [];
  let start: number | undefined;
  let last = 0;
  const flush = (): void => {
    if (start !== undefined && last - start >= SCROLL_MIN_SPAN_MS) {
      runs.push({ startMs: start, durMs: last - start + SCROLL_TAIL_MS });
    }
  };
  for (const t of sorted) {
    if (start === undefined) {
      start = t;
      last = t;
    } else if (t - last > SCROLL_GAP_MS) {
      flush();
      start = t;
      last = t;
    } else {
      last = t;
    }
  }
  flush();
  return runs;
}

/**
 * Normalizes a sound input to a common format and splits it into `n` copies so
 * each placement gets its own stream. Appends the needed filter nodes to `parts`.
 * @param srcLabel - The ffmpeg input label (e.g. `"1:a"`).
 * @param prefix - A short unique label prefix for this input's streams.
 * @param n - How many copies are needed (>= 1).
 * @param parts - The filter-graph node list to append to.
 * @param preFilter - Optional extra filter(s) to run on the base stream after
 *   format normalization (e.g. stripping leading silence), applied once.
 * @returns The `n` output stream labels to consume downstream.
 * @example
 * prepAndSplit("1:a", "c", 2, parts); // => ["c0", "c1"]
 * @source
 */
function prepAndSplit(
  srcLabel: string,
  prefix: string,
  n: number,
  parts: string[],
  preFilter = '',
): string[] {
  const base = `${prefix}base`;
  const pre = preFilter ? `,${preFilter}` : '';
  parts.push(`[${srcLabel}]aformat=sample_rates=48000:channel_layouts=stereo${pre}[${base}]`);
  if (n === 1) {
    return [base];
  }
  const labels = Array.from({ length: n }, (_unused, i) => `${prefix}${i}`);
  parts.push(`[${base}]asplit=${n}[${labels.join('][')}]`);
  return labels;
}

/**
 * Builds the ffmpeg `filter_complex` that places the click sound (input 1) at
 * each click, a trimmed slice of the typing sound (input 2) at each typing run,
 * and a trimmed slice of the scroll sound (input 3) at each scroll run, then
 * mixes them without volume normalization.
 * @param clicksMs - Click offsets (ms) into the video.
 * @param typingRuns - Typing runs from {@link toTypingRuns}.
 * @param scrollRuns - Scroll runs from {@link toScrollRuns}.
 * @returns The filter string and its output label, or `undefined` if nothing to place.
 * @example
 * buildAudioFilter([500], [{ startMs: 1200, durMs: 900 }], []);
 * @source
 */
function buildAudioFilter(
  clicksMs: number[],
  typingRuns: SoundRun[],
  scrollRuns: SoundRun[],
): { filter: string; outLabel: string } | undefined {
  const parts: string[] = [];
  const mix: string[] = [];

  if (clicksMs.length > 0) {
    const labels = prepAndSplit('1:a', 'c', clicksMs.length, parts, LEADIN_TRIM);
    clicksMs.forEach((t, i) => {
      const vol = CLICK_VOLUME === 1 ? '' : `volume=${CLICK_VOLUME},`;
      parts.push(`[${labels[i]}]${vol}adelay=${Math.round(t)}:all=1[cd${i}]`);
      mix.push(`cd${i}`);
    });
  }

  if (typingRuns.length > 0) {
    const labels = prepAndSplit('2:a', 't', typingRuns.length, parts, LEADIN_TRIM);
    typingRuns.forEach((run, i) => {
      const vol = TYPING_VOLUME === 1 ? '' : `volume=${TYPING_VOLUME},`;
      const durSec = (run.durMs / 1000).toFixed(3);
      parts.push(
        `[${labels[i]}]atrim=0:${durSec},asetpts=PTS-STARTPTS,${vol}adelay=${Math.round(run.startMs)}:all=1[td${i}]`,
      );
      mix.push(`td${i}`);
    });
  }

  if (scrollRuns.length > 0) {
    const labels = prepAndSplit('3:a', 's', scrollRuns.length, parts);
    scrollRuns.forEach((run, i) => {
      const vol = SCROLL_VOLUME === 1 ? '' : `volume=${SCROLL_VOLUME},`;
      const durSec = (run.durMs / 1000).toFixed(3);
      parts.push(
        `[${labels[i]}]atrim=0:${durSec},asetpts=PTS-STARTPTS,${vol}adelay=${Math.round(run.startMs)}:all=1[sd${i}]`,
      );
      mix.push(`sd${i}`);
    });
  }

  if (mix.length === 0) {
    return undefined;
  }
  const premix = mix.length === 1 ? mix[0] : 'amixed';
  if (mix.length > 1) {
    parts.push(
      `[${mix.join('][')}]amix=inputs=${mix.length}:normalize=0:dropout_transition=0[amixed]`,
    );
  }
  // Regenerate clean, sample-based PTS from 0. Over a real Playwright VP8
  // recording, amix can emit a NOPTS start timestamp, which the mp4 muxer turns
  // into a garbage start_time/duration (INT64_MAX) with no audible sound.
  parts.push(`[${premix}]asetpts=N/SR/TB[aout]`);
  return { filter: parts.join(';'), outLabel: 'aout' };
}

/**
 * Whether an executable responds to `-version` (used to detect ffmpeg).
 * @param bin - The executable name to probe.
 * @returns `true` if it ran, `false` otherwise.
 * @example
 * await hasBinary("ffmpeg"); // => true when ffmpeg is installed
 * @source
 */
async function hasBinary(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ['-version']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the sound files are present and readable.
 * @returns `true` if the click, typing, and scroll sounds exist.
 * @example
 * await soundsExist(); // => true when demo/assets/*.mp3 are in place
 * @source
 */
async function soundsExist(): Promise<boolean> {
  try {
    await Promise.all([fs.access(CLICK_SOUND), fs.access(TYPING_SOUND), fs.access(SCROLL_SOUND)]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads a media file's duration in seconds via ffprobe.
 * @param file - Path to the media file.
 * @returns The duration in seconds, or `undefined` if it can't be determined.
 * @example
 * await probeDurationSec("run.webm"); // => 42.3
 * @source
 */
async function probeDurationSec(file: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      file,
    ]);
    const seconds = Number(stdout.trim());
    return Number.isFinite(seconds) ? seconds : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Produces an `.mp4` copy of a recorded `.webm` with the click, typing, and
 * scroll sounds overlaid. No-ops (with a warning) when there are no events,
 * ffmpeg is missing, or the sound files are absent, and swallows any ffmpeg
 * error so it never fails the demo run.
 * @param webmPath - Path to the Playwright-recorded silent `.webm`.
 * @param targetMp4 - Optional output path; defaults to `<webm>-sfx.mp4`.
 * @returns The output `.mp4` path when written, otherwise `undefined`.
 * @example
 * const mp4 = await addSfxToVideo("demo/output/videos/abc.webm");
 * // => "demo/output/videos/abc-sfx.mp4"
 * @source
 */
export async function addSfxToVideo(
  webmPath: string,
  targetMp4?: string,
): Promise<string | undefined> {
  const clicksMs = events
    .filter((e) => e.kind === 'click')
    .map((e) => e.atMs + SFX_SYNC_OFFSET_MS + CLICK_LAG_MS)
    .filter((t) => t >= 0);
  const keyTimesMs = events
    .filter((e) => e.kind === 'key')
    .map((e) => e.atMs + SFX_SYNC_OFFSET_MS)
    .filter((t) => t >= 0);
  const scrollTimesMs = events
    .filter((e) => e.kind === 'scroll')
    .map((e) => e.atMs + SFX_SYNC_OFFSET_MS)
    .filter((t) => t >= 0);
  const typingRuns = toTypingRuns(keyTimesMs);
  const scrollRuns = toScrollRuns(scrollTimesMs);

  if (clicksMs.length === 0 && typingRuns.length === 0 && scrollRuns.length === 0) {
    console.warn('[demo] no interaction events captured; skipping SFX');
    return undefined;
  }
  if (!(await hasBinary('ffmpeg'))) {
    console.warn('[demo] ffmpeg not found; skipping SFX (is ffmpeg installed?)');
    return undefined;
  }
  if (!(await soundsExist())) {
    console.warn('[demo] sound files missing under demo/assets; skipping SFX');
    return undefined;
  }

  const graph = buildAudioFilter(clicksMs, typingRuns, scrollRuns);
  if (graph === undefined) {
    return undefined;
  }

  const outMp4Path = targetMp4 ?? webmPath.replace(/\.webm$/i, '-sfx.mp4');
  try {
    const durationSec = await probeDurationSec(webmPath);
    const args = [
      '-y',
      '-i',
      webmPath,
      '-i',
      CLICK_SOUND,
      '-i',
      TYPING_SOUND,
      '-i',
      SCROLL_SOUND,
      '-filter_complex',
      graph.filter,
      '-map',
      '0:v:0',
      '-map',
      `[${graph.outLabel}]`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
    ];
    if (durationSec !== undefined) {
      args.push('-t', durationSec.toFixed(3));
    }
    args.push(outMp4Path);
    await execFileAsync('ffmpeg', args);
    console.log(
      `[demo] wrote ${outMp4Path} (${clicksMs.length} clicks, ${typingRuns.length} typing runs, ${scrollRuns.length} scroll runs)`,
    );
    return outMp4Path;
  } catch (error) {
    console.warn('[demo] SFX mux failed:', error);
    return undefined;
  }
}

/**
 * Reads a video's pixel dimensions via ffprobe.
 * @param file - Path to the video.
 * @returns The `{ width, height }`, or `undefined` if they can't be read.
 * @example
 * await probeVideoSize("run.mp4"); // => { width: 1280, height: 800 }
 * @source
 */
async function probeVideoSize(
  file: string,
): Promise<{ width: number; height: number } | undefined> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      file,
    ]);
    const [width, height] = stdout.trim().split(',').map(Number);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Whether a file has an audio stream.
 * @param file - Path to the media file.
 * @returns `true` if an audio stream is present.
 * @example
 * await hasAudioStream("run.mp4"); // => true
 * @source
 */
async function hasAudioStream(file: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_type',
      '-of',
      'csv=p=0',
      file,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Renders the intro/outro card — the ChemPal logo centered on a white
 * background at the given size — to a PNG.
 * @param cardPath - Where to write the card image.
 * @param width - Card width (matches the video).
 * @param height - Card height (matches the video).
 * @returns Resolves once the PNG is written.
 * @example
 * await generateCard("card.png", 1280, 800);
 * @source
 */
async function generateCard(cardPath: string, width: number, height: number): Promise<void> {
  const logoSize = Math.round(Math.min(width, height) * 0.5);
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `color=c=white:s=${width}x${height}`,
    '-i',
    CARD_LOGO,
    '-filter_complex',
    `[1]scale=${logoSize}:-1[lg];[0][lg]overlay=(W-w)/2:(H-h)/2`,
    '-frames:v',
    '1',
    cardPath,
  ]);
}

/**
 * Wraps a demo video with an intro and outro: it opens on a white card with the
 * centered ChemPal logo, crossfades into the demo, and crossfades back to the
 * card at the end. Rewrites the file in place. No-ops (with a warning, keeping
 * the original) when ffmpeg is missing, the logo/probe is unavailable, or the
 * ffmpeg pass errors — so it never fails the demo run. The demo's audio is
 * delayed to stay in sync and padded with silence over the card segments.
 * @param videoPath - Path to the demo `.mp4` to wrap (overwritten on success).
 * @returns The `videoPath` when wrapped, otherwise `undefined`.
 * @example
 * await addIntroOutro("demo-results/videos/abc-sfx.mp4");
 * @source
 */
export async function addIntroOutro(videoPath: string): Promise<string | undefined> {
  if (!(await hasBinary('ffmpeg'))) {
    console.warn('[demo] ffmpeg not found; skipping intro/outro');
    return undefined;
  }
  const durationSec = await probeDurationSec(videoPath);
  if (durationSec === undefined) {
    console.warn('[demo] could not probe demo duration; skipping intro/outro');
    return undefined;
  }

  const size = (await probeVideoSize(videoPath)) ?? { width: 1280, height: 800 };
  const withAudio = await hasAudioStream(videoPath);
  const cardPath = videoPath.replace(/\.mp4$/i, '.card.png');
  const tmpPath = videoPath.replace(/\.mp4$/i, '.io.tmp.mp4');

  // Crossfade start offsets and the padded total duration.
  const off1 = INTRO_SEC - XFADE_SEC;
  const off2 = INTRO_SEC + durationSec - 2 * XFADE_SEC;
  const totalSec = INTRO_SEC + durationSec + OUTRO_SEC - 2 * XFADE_SEC;
  const audioDelayMs = Math.round(off1 * 1000);

  const norm = (input: string, out: string): string =>
    `[${input}]fps=30,scale=${size.width}:${size.height},setsar=1,format=yuv420p,settb=AVTB[${out}]`;
  const filterParts = [
    norm('1:v', 'intro'),
    norm('2:v', 'outro'),
    norm('0:v', 'demo'),
    `[intro][demo]xfade=transition=fade:duration=${XFADE_SEC}:offset=${off1.toFixed(3)}[iv]`,
    `[iv][outro]xfade=transition=fade:duration=${XFADE_SEC}:offset=${off2.toFixed(3)}[v]`,
  ];
  if (withAudio) {
    filterParts.push(
      `[0:a]adelay=${audioDelayMs}|${audioDelayMs},apad,atrim=0:${totalSec.toFixed(3)}[a]`,
    );
  }

  try {
    await generateCard(cardPath, size.width, size.height);
    const args = [
      '-y',
      '-i',
      videoPath,
      '-loop',
      '1',
      '-t',
      String(INTRO_SEC),
      '-i',
      cardPath,
      '-loop',
      '1',
      '-t',
      String(OUTRO_SEC),
      '-i',
      cardPath,
      '-filter_complex',
      filterParts.join(';'),
      '-map',
      '[v]',
    ];
    if (withAudio) {
      args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
    }
    args.push(
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      tmpPath,
    );
    await execFileAsync('ffmpeg', args);
    await fs.rename(tmpPath, videoPath);
    console.log(`[demo] added intro/outro to ${videoPath}`);
    return videoPath;
  } catch (error) {
    console.warn('[demo] intro/outro failed:', error);
    return undefined;
  } finally {
    await fs.rm(cardPath, { force: true });
    await fs.rm(tmpPath, { force: true });
  }
}
