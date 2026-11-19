// Shared layer for verify-sweep.mjs and route-shots.mjs: project config,
// browser launch (Playwright resolved from the PROJECT, never from this
// skill), ignore-key matching, and the settle wait.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = {
  base: 'http://localhost:5173',
  routes: ['/'],
  hashRouting: false,
  colorSchemes: ['light'],
  widths: [390, 1440, 1920, 2560, 3440, 5120],
  voidViewports: [[1920, 1080], [1440, 900]],
  heroViewports: [[1366, 768], [1440, 900], [1920, 1080]],
  headSelector: '[data-page-head]',
  headExempt: [],
  maskSelectors: [],
  chromeSelectors: 'nav, [class*="hud"]',
  readySelector: 'main h1, h1',
  pendingSelector: '[data-reveal-pending]',
  fillSelector: '',
  voidBand: 260,
  tapMin: 24,
  eyebrowRatio: 3, // layout.md: at most 1 eyebrow per N sections
  ctaWordsMax: 3, // layout.md: CTA labels are 1-3 words
  ctaExclude: '', // selector for link chips/tags that are styled like buttons but are not calls to action
  radiusMax: 4, // layout.md: distinct corner-radius values per page
  copyHeadingMax: 8, // layout.md: default section headline word cap (warn only)
  copyParaMax: 25, // layout.md: default section sub-paragraph word cap (warn only)
  checks: {},
  ignoreFile: 'verify-sweep.ignore.json',
  extend: '',
  shotsDir: 'docs/shots',
};

export const ALL_CHECKS = [
  'hscroll', 'console', 'type-census', 'hero-fill', 'scale-twin', 'aa', 'occlusion',
  'sticky-chrome', 'clipped-text', 'focus', 'tap', 'tap-desktop', 'void-mid', 'void',
  'eyebrows', 'cta-words', 'cta-intent', 'radius-scale', 'copy-length', 'grain-layer', 'broken-media',
  'never-visible',
];

// Opt-in checks: off unless a project sets checks[id] === true (layout.md rules 2026-09-21).
const OPT_IN = ['scale-twin', 'eyebrows', 'cta-words', 'cta-intent', 'radius-scale', 'copy-length', 'grain-layer'];

/** Merge verify-sweep.config.json (if present) over DEFAULTS. */
export function loadConfig(cwd = process.cwd(), read = readFileSync, exists = existsSync) {
  const p = join(cwd, 'verify-sweep.config.json');
  const user = exists(p) ? JSON.parse(read(p, 'utf8')) : {};
  const cfg = { ...DEFAULTS, ...user, checks: { ...user.checks } };
  if (process.env.VERIFY_BASE) cfg.base = process.env.VERIFY_BASE; // a second dev server on another port
  cfg.enabled = (id) => cfg.checks[id] !== false && (!OPT_IN.includes(id) || cfg.checks[id] === true);
  cfg.url = (route) => cfg.base + (cfg.hashRouting ? '/#' + route : route);
  return cfg;
}

/** Ignore keys: substring by default; `/re/` is a regex; `linux:` scopes to a Linux host. */
export function keyHits(key, text, platform = process.platform) {
  let k = key;
  if (k.startsWith('linux:')) {
    if (platform !== 'linux') return false;
    k = k.slice(6);
  }
  return k.length > 2 && k.startsWith('/') && k.endsWith('/') ? new RegExp(k.slice(1, -1)).test(text) : text.includes(k);
}

export function loadIgnores(cwd, cfg) {
  const p = resolve(cwd, cfg.ignoreFile);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
}

export function partition(findings, ignores, platform) {
  const keys = Object.keys(ignores);
  const active = findings.filter((f) => !keys.some((k) => keyHits(k, f.id + ' ' + f.msg, platform)));
  return { active, ignored: findings.length - active.length };
}

const CHROME_PATHS = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ],
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

/** Chrome to launch: $PW_CHROME / $CHROME_PATH, else the first installed Chrome for this OS, else null (bundled chromium). */
export function chromePath(env = process.env, platform = process.platform, exists = existsSync) {
  const set = env.PW_CHROME || env.CHROME_PATH;
  if (set) {
    if (!exists(set)) throw new Error(`PW_CHROME/CHROME_PATH is set to "${set}" but no file is there.`);
    return set;
  }
  return (CHROME_PATHS[platform] ?? []).find((p) => exists(p)) ?? null;
}

/** Playwright from the project's own node_modules (playwright-core, then playwright). */
async function chromiumFrom(cwd) {
  const req = createRequire(join(cwd, 'package.json'));
  for (const name of ['playwright-core', 'playwright']) {
    try {
      const mod = await import(pathToFileURL(req.resolve(name)).href);
      return mod.chromium ?? mod.default?.chromium;
    } catch {
      /* try next */
    }
  }
  throw new Error(`No playwright-core or playwright in ${cwd}/node_modules — add one as a devDependency.`);
}

/** launch(cwd, opts): Chrome from chromePath(), else bundled chromium. */
export async function launch(cwd = process.cwd(), opts = {}) {
  const chromium = await chromiumFrom(cwd);
  // Hinting off so text scales linearly across viewports on Linux runners too.
  opts = { headless: true, ...opts, args: ['--font-render-hinting=none', ...(opts.args ?? [])] };
  const executablePath = chromePath();
  return chromium.launch(executablePath ? { ...opts, executablePath } : opts);
}

/**
 * Wait until the route has actually mounted: ready selector has text (or main
 * has content after 5s), fonts loaded, no reveal still pending, every fill
 * container populated — then hold the route's own beat.
 */
export async function settle(page, cfg, beat) {
  const start = Date.now();
  await page
    .waitForFunction(
      ([startTime, ready, pending, fill]) => {
        const h = (document.querySelector(ready)?.textContent || '').trim();
        const mounted = h.length > 0 || (Date.now() - startTime > 5000 && !!document.querySelector('main, #root, body')?.textContent?.trim());
        const filled = !fill || [...document.querySelectorAll(fill)].every((f) => f.children.length > 0);
        const noPending = !pending || document.querySelectorAll(pending).length === 0;
        return mounted && filled && document.fonts.status === 'loaded' && noPending;
      },
      [start, cfg.readySelector, cfg.pendingSelector, cfg.fillSelector],
      { timeout: 30000, polling: 100 },
    )
    .catch(() => {});
  await page.waitForTimeout(beat);
}
