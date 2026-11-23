// Records the README screenshots and demo video into docs/media/.
// Usage: npm run media            (both)
//        npm run media -- --only shots | --only video
import { devServer, launch, wait, tap, typeSlow, smoothScroll, shot, startRecording, encode, ROOT, OUT, only } from './lib.mjs';

const URL = 'http://localhost:5173/';
const stopServer = await devServer(URL, 'npx vite --port 5173 --strictPort', { cwd: ROOT });
const nav = (page, name) => page.getByRole('navigation').getByRole('link', { name });
const locate = (page) => page.getByRole('button', { name: /Locate/ }).or(page.getByRole('link', { name: /Locate/ })).first();
const labels = (page) => page.getByRole('link', { name: /Labels/ }).or(page.getByRole('button', { name: /Labels/ })).first();

try {
  if (only('shots')) {
    const { browser, page } = await launch();
    await page.goto(URL);
    await page.getByRole('button', { name: 'Explore with demo data' }).click();
    await wait(page, 2000);
    await shot(page, `${OUT}/01-boxes.png`);
    await page.getByText('B-001 Pots & pans').click(); await wait(page, 1200);
    await shot(page, `${OUT}/02-box.png`);
    await nav(page, 'Search').click(); await wait(page, 500);
    await page.locator('input').first().fill('wafle'); await wait(page, 1000); // typo on purpose
    await shot(page, `${OUT}/03-search.png`);
    await locate(page).click(); await wait(page, 1500);
    await shot(page, `${OUT}/04-stack-front.png`);
    await page.getByText('Floor plan', { exact: true }).click(); await wait(page, 1200);
    await shot(page, `${OUT}/05-floor-plan.png`);
    await page.goto(URL + '#/labels'); await wait(page, 1500);
    await shot(page, `${OUT}/06-labels.png`);
    await browser.close();
  }

  if (only('video')) {
    const { browser, page } = await launch();
    await page.goto(URL); await wait(page, 1500);
    const rec = await startRecording(page);
    await wait(page, 1200);
    await tap(page, page.getByRole('button', { name: 'Explore with demo data' })); await wait(page, 1800);
    await smoothScroll(page, 500); await wait(page, 600);
    await smoothScroll(page, -500); await wait(page, 500);
    await tap(page, page.getByText('B-001 Pots & pans')); await wait(page, 1600);
    await smoothScroll(page, 450); await wait(page, 1200);
    await tap(page, nav(page, 'Search')); await wait(page, 700);
    await typeSlow(page, page.locator('input').first(), 'waffle', 120); await wait(page, 1600);
    await tap(page, locate(page)); await wait(page, 2200);
    await tap(page, page.getByText('Floor plan', { exact: true })); await wait(page, 2200);
    // The box list shows "0 items" for a moment while counts load, so wait before moving on.
    await tap(page, nav(page, 'Boxes')); await wait(page, 2000);
    await tap(page, labels(page)); await wait(page, 1200);
    await smoothScroll(page, 700, { steps: 30 }); await wait(page, 1500);
    const frames = await rec.stop();
    await browser.close();
    encode(frames, OUT, 'demo', { posterAt: 0.55 });
  }
} finally {
  await stopServer();
}
