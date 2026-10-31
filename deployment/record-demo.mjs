// Fixture-only backup recording. Run after building; uses the independent supplied mock.
import { chromium } from '../web/node_modules/playwright/index.mjs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../bootstrap/server.mjs';

const server = await createAppServer({ apiHandlerModule: null, bundlePath: 'fixtures/artifact-bundle.fixture.json' });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const directory = fileURLToPath(new URL('./demo/', import.meta.url));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, recordVideo: { dir: directory, size: { width: 1366, height: 900 } } });
  const page = await context.newPage();
  const pause = () => page.waitForTimeout(1800);
  await page.goto(base); await page.getByRole('heading', { name: 'Impact at a glance' }).waitFor(); await pause();
  await page.getByLabel('What are you intending to change?').fill('Review cancellation handling within this prepared scenario.'); await pause();
  await page.getByRole('button', { name: 'Generate briefing' }).click();
  const briefing = page.getByRole('article', { name: 'Generated briefing' }); await briefing.waitFor(); await briefing.scrollIntoViewIfNeeded(); await pause();
  await briefing.getByRole('link', { name: 'Inspect evidence GF001' }).click(); await pause();
  await page.getByRole('button', { name: 'Download Markdown' }).click(); await pause();
  await page.getByRole('button', { name: /Partial analysis with unresolved wiring/ }).click();
  await page.getByText('Partial / unresolved evidence — inspect the warnings below').waitFor(); await page.locator('.warnings').scrollIntoViewIfNeeded(); await pause();
  await page.getByRole('button', { name: /No usable static evidence/ }).click();
  await page.getByText('Empty result — no usable evidence').waitFor();
  await page.getByRole('button', { name: 'Generate briefing' }).click(); await page.getByRole('alert').waitFor(); await pause();
  await context.close();
  await page.video().saveAs(fileURLToPath(new URL('./demo/fixture-walkthrough.webm', import.meta.url)));
  await page.video().delete();
  console.log('Saved deployment/demo/fixture-walkthrough.webm — synthetic fixtures, canned inference; no live model.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
