import assert from 'node:assert/strict';
import { chromium } from '../web/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const target = process.argv[2];
if (!target || !/^https:\/\//.test(target)) throw new Error('Provide the public HTTPS application URL.');
const base = new URL(target).origin;
const directory = new URL('./verification/', import.meta.url);
await mkdir(directory, { recursive: true });
const report = { checkedAt: new Date().toISOString(), baseUrl: base, verification: 'public-fixture-browser', authenticated: false, simulatedResponses: false, passed: false, checks: [] };
let browser;
async function check(name, action) {
  await action(); report.checks.push({ name, passed: true });
}
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const result = page.getByRole('article', { name: 'Generated briefing' });
  const generate = () => page.getByRole('button', { name: 'Generate briefing' }).click();
  await check('public health: mock API, synthetic artifacts and canned inference', async () => {
    const response = await context.request.get(`${base}/api/v1/health`);
    assert.equal(response.status(), 200);
    const { data } = await response.json();
    assert.deepEqual(data, { status: 'ok', apiMode: 'mock', aiMode: 'fixture', artifactKind: 'fixture', gemmaConfigured: false });
    report.health = data;
  });
  await check('built public dashboard and provenance load without authentication', async () => {
    const response = await page.goto(base);
    assert.equal(response.status(), 200);
    await page.getByRole('heading', { name: 'Impact at a glance' }).waitFor();
    assert.equal(await page.getByText('Analysis · Synthetic fixture').isVisible(), true);
    assert.equal(await page.getByText('Local mock verification').count(), 0);
  });
  let briefing;
  await check('actual hosted briefing request returns a labeled fixture with citations', async () => {
    await page.getByLabel('What are you intending to change?').fill('Verify hosted cancellation review within the prepared scenario.');
    const responsePromise = page.waitForResponse(response => response.url() === `${base}/api/v1/briefings` && response.request().method() === 'POST');
    await generate();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    briefing = (await response.json()).data;
    await result.waitFor();
    assert.equal(briefing.mode, 'fixture'); assert.equal(briefing.artifactKind, 'fixture'); assert.equal(briefing.model, null);
    assert.ok((await result.innerText()).includes('Fixture inference · No model called'));
    assert.ok((await result.innerText()).includes(briefing.commitSha));
  });
  await check('citation navigation focuses the original evidence record', async () => {
    await result.getByRole('link', { name: 'Inspect evidence GF001' }).click();
    assert.equal(await page.locator('#evidence-GF001').evaluate(element => element === document.activeElement), true);
    assert.ok((await page.locator('#evidence-GF001').innerText()).includes('Synthetic fixture — source link unavailable.'));
  });
  await check('downloaded Markdown exactly matches hosted service bytes', async () => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Markdown' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'review-subscription-change.md');
    const bytes = await readFile(await download.path());
    assert.equal(bytes.toString('utf8'), briefing.markdown);
    report.exportSha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(new URL('./public-fixture-briefing.md', directory), bytes);
  });
  await check('partial case preserves warnings and clears the old briefing', async () => {
    await page.getByRole('button', { name: /Partial analysis with unresolved wiring/ }).click();
    await page.getByText('Partial / unresolved evidence — inspect the warnings below').waitFor();
    assert.equal(await result.count(), 0);
    assert.ok((await page.locator('.warnings').innerText()).includes('One source file could not be parsed'));
    await generate(); await result.waitFor();
    assert.ok((await result.innerText()).includes('One source file could not be parsed'));
  });
  await check('empty evidence produces a real hosted 422 explanation', async () => {
    await page.getByRole('button', { name: /No usable static evidence/ }).click();
    await page.getByText('Empty result — no usable evidence').waitFor();
    const responsePromise = page.waitForResponse(response => response.url() === `${base}/api/v1/briefings`);
    await generate();
    assert.equal((await responsePromise).status(), 422);
    await page.getByRole('alert').waitFor();
    assert.ok((await page.getByRole('alert').innerText()).includes('INSUFFICIENT_EVIDENCE'));
    assert.equal(await page.getByRole('button', { name: 'Retry request' }).count(), 0);
  });
  await page.getByRole('button', { name: /Change subscription cancellation behavior/ }).click();
  await page.getByRole('heading', { name: 'Impact at a glance' }).waitFor();
  await generate(); await result.waitFor();
  for (const width of [1366, 390]) {
    await check(`public layout ${width}px fits the viewport`, async () => {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: fileURLToPath(new URL(`./public-dashboard-${width}.png`, directory)), fullPage: true });
    });
  }
  await context.close(); report.passed = true;
} catch (error) {
  report.error = error.message; process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(new URL('./public-browser.json', directory), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
