// Helpers for recording README screenshots and demo videos in a phone-sized Chromium.
// The same file lives in each app's scripts/media/ folder; keep the copies in sync.
//
// How it works:
// - The page is laid out at 393x852 CSS px (iPhone 15 Pro) and rendered at 2x. Chromium's
//   screencast only gives 1x frames for an emulated device scale, so instead the window is
//   786x1704 and the page's viewport meta is forced to width=393 at scale 2.
// - Frames come from the CDP screencast (sent only when something changes, with timestamps),
//   then ffmpeg turns them into an MP4, a GIF for the README and a poster JPEG.
import { chromium } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';
import { Buffer } from 'node:buffer';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VIEWPORT = { width: 393, height: 852 };
const SCALE = 2;
const WINDOW = { width: VIEWPORT.width * SCALE, height: VIEWPORT.height * SCALE };

const BASE_CSS = `
  .__tap{position:fixed;z-index:2147483647;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;
    border-radius:50%;background:rgba(120,120,120,.35);border:2px solid rgba(255,255,255,.85);
    box-shadow:0 0 0 1px rgba(0,0,0,.25);transform:scale(.6);opacity:1;transition:transform .35s ease-out,opacity .45s ease-in .15s}
  .__tap.go{transform:scale(1.15);opacity:0}
  html,body{overflow-x:hidden !important;overscroll-behavior-x:none}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Use the dev server at `url` if it's already running, otherwise start `command` and wait for it.
 * Returns a function that stops the server again (only if we started it).
 */
export async function devServer(url, command, { cwd, env = {}, timeoutMs = 180_000 } = {}) {
  if (await reachable(url)) {
    console.log(`Using the dev server already running at ${url}`);
    return async () => {};
  }
  console.log(`Starting: ${command}`);
  const child = spawn(command, { cwd, shell: true, stdio: 'ignore', env: { ...process.env, ...env } });
  const deadline = Date.now() + timeoutMs;
  while (!(await reachable(url))) {
    if (child.exitCode !== null) throw new Error(`"${command}" exited with code ${child.exitCode}`);
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`);
    await sleep(1000);
  }
  return async () => {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  };
}

/**
 * Launch Chromium with a phone-sized page.
 * - extraCss: injected into every page (e.g. to recolour the tap indicator).
 * - flagFont: Windows has no flag emoji. Loads Twemoji country flags (from jsDelivr) for
 *   regional-indicator characters only, so flags look like they do on a phone.
 * Other options go straight to browser.newContext (timezoneId, geolocation, ...).
 */
export async function launch({ colorScheme = 'light', flagFont = false, extraCss = '', ...contextOptions } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: WINDOW,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    colorScheme,
    ...contextOptions,
  });

  await context.addInitScript((css) => {
    const add = () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  }, BASE_CSS + extraCss);

  // Force the viewport to 393 CSS px at 2x (see the note at the top).
  await context.addInitScript((w) => {
    const content = `width=${w}, initial-scale=2, minimum-scale=2, maximum-scale=2, user-scalable=no, viewport-fit=cover`;
    const fix = () =>
      document.querySelectorAll('meta[name=viewport]').forEach((m) => {
        if (m.content !== content) m.content = content;
      });
    new MutationObserver(fix).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['content'] });
    document.addEventListener('DOMContentLoaded', () => {
      fix();
      if (!document.querySelector('meta[name=viewport]')) {
        const m = document.createElement('meta');
        m.name = 'viewport';
        m.content = content;
        document.head.appendChild(m);
      }
    });
  }, VIEWPORT.width);

  // React Native Web: it computes the window width as visualViewport.width * scale (on a real
  // phone the scale is 1), and reads it once at start-up, so report 1 and send a resize.
  await context.addInitScript(() => {
    try {
      Object.defineProperty(VisualViewport.prototype, 'scale', { get: () => 1, configurable: true });
    } catch {}
    window.addEventListener('load', () =>
      [50, 400, 1200].forEach((t) => setTimeout(() => window.dispatchEvent(new Event('resize')), t)),
    );
  });

  if (flagFont) {
    const res = await fetch('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.8/dist/TwemojiCountryFlags.woff2');
    if (!res.ok) throw new Error(`Couldn't download the flag font (HTTP ${res.status})`);
    const font = Buffer.from(await res.arrayBuffer());
    await context.route('**/__flags.woff2', (r) => r.fulfill({ body: font, contentType: 'font/woff2' }));
    await context.addInitScript(() => {
      const flag = /[\u{1F1E6}-\u{1F1FF}]/u;
      const patch = (root) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || el.dataset.__flags || !flag.test(n.data)) continue;
          el.dataset.__flags = '1';
          el.style.fontFamily = "'__Flags', " + getComputedStyle(el).fontFamily;
        }
      };
      document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style');
        st.textContent = "@font-face{font-family:'__Flags';src:url('/__flags.woff2') format('woff2');unicode-range:U+1F1E6-1F1FF;}";
        document.head.appendChild(st);
        patch(document.body);
        new MutationObserver((ms) =>
          ms.forEach((m) => {
            m.addedNodes.forEach((a) => patch(a.nodeType === 1 ? a : (a.parentElement ?? document.body)));
            if (m.type === 'characterData' && m.target.parentElement) {
              delete m.target.parentElement.dataset.__flags;
              patch(m.target.parentElement);
            }
          }),
        ).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    });
  }

  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  return { browser, context, page };
}

export const wait = (page, ms) => page.waitForTimeout(ms);

/** Show a tap indicator at the element's centre, then tap it. */
export async function tap(page, locator, { hold = 250 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('tap: element has no bounding box');
  await ripple(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(hold);
  await locator.click();
}

export async function ripple(page, x, y) {
  await page.evaluate(
    ([x, y]) => {
      const d = document.createElement('div');
      d.className = '__tap';
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      document.body.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('go')));
      setTimeout(() => d.remove(), 900);
    },
    [x, y],
  );
}

/** Type one character at a time, so the video shows it. */
export async function typeSlow(page, locator, text, delay = 70) {
  await locator.click();
  await locator.pressSequentially(text, { delay });
}

/** Scroll the page (or the element matching `selector`) by dy pixels, in small steps. */
export async function smoothScroll(page, dy, { selector, steps = 20, stepMs = 25 } = {}) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate(
      ([sel, d]) => ((sel && document.querySelector(sel)) || window).scrollBy(0, d),
      [selector ?? null, dy / steps],
    );
    await page.waitForTimeout(stepMs);
  }
}

export async function shot(page, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file });
  console.log('screenshot', path.basename(file));
}

/** Start recording the page. Call stop() on the result to get the frames for encode(). */
export async function startRecording(page) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'media-frames-'));
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, t: f.metadata.timestamp });
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: WINDOW.width, maxHeight: WINDOW.height });
  return {
    async stop() {
      await page.waitForTimeout(300);
      await cdp.send('Page.stopScreencast');
      // The last frame stays on screen for half a second.
      frames.push({ file: null, t: frames.at(-1).t + 0.5 });
      return frames;
    },
  };
}

const ffmpeg = (args) => execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

/**
 * Write <name>.mp4 (H.264, 30 fps), <name>.gif (300 px wide, for the README) and
 * <name>-poster.jpg (the frame at `posterAt`, 0-1 through the video) into outDir.
 */
export function encode(frames, outDir, name, { gifWidth = 300, gifFps = 12, posterAt = 0.35 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const real = frames.filter((f) => f.file);
  const dir = path.dirname(real[0].file);
  const listFile = path.join(dir, 'list.txt');
  let list = '';
  for (let i = 0; i < real.length; i++) {
    const duration = Math.max(0.001, frames[i + 1].t - real[i].t);
    list += `file '${real[i].file.replace(/\\/g, '/')}'\nduration ${duration.toFixed(4)}\n`;
  }
  list += `file '${real.at(-1).file.replace(/\\/g, '/')}'\n`;
  fs.writeFileSync(listFile, list);

  const mp4 = path.join(outDir, `${name}.mp4`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-movflags', '+faststart', '-an', mp4]);

  const gif = path.join(outDir, `${name}.gif`);
  ffmpeg(['-i', mp4, '-vf',
    `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
    '-loop', '0', gif]);

  const poster = path.join(outDir, `${name}-poster.jpg`);
  const total = frames.at(-1).t - real[0].t;
  ffmpeg(['-ss', String(total * posterAt), '-i', mp4, '-frames:v', '1', '-q:v', '3', poster]);

  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of [mp4, gif, poster]) console.log(path.basename(f), (fs.statSync(f).size / 1024).toFixed(0) + ' KB');
}

/** The repo root and its docs/media/ folder (this file lives in scripts/media/). */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(ROOT, 'docs/media');

/** `--only shots` or `--only video` runs just one half. */
export const only = (part) => {
  const i = process.argv.indexOf('--only');
  return i === -1 || process.argv[i + 1] === part;
};
