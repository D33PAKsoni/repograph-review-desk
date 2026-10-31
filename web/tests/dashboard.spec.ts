import { test, expect, type Page } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

async function ready(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Impact at a glance' })).toBeVisible();
}
const generate = (page: Page) => page.getByRole('button', { name: 'Generate briefing' });
const output = (page: Page) => page.getByRole('article', { name: 'Generated briefing' });

test('journey preserves fixture provenance, request contract, citations, and exact Markdown bytes', async ({ page }) => {
  await ready(page);
  await expect(page.getByText('Analysis · Synthetic fixture')).toBeVisible();
  await expect(page.getByText('Synthetic fixture — source link unavailable.')).toHaveCount(3);
  const intent = '<img src=x onerror=alert(1)> Review cancellation';
  await page.getByLabel('What are you intending to change?').fill(intent);
  const requestPromise = page.waitForRequest(request => request.method() === 'POST');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/briefings'));
  await generate(page).click();
  const request = await requestPromise;
  expect(request.postDataJSON()).toEqual({ caseId: 'subscription-change', changeIntent: intent });
  expect(request.headers()['content-type']).toBe('application/json');
  const response = await responsePromise;
  const { data } = await response.json();
  await expect(output(page)).toContainText('Fixture inference · No model called');
  await expect(output(page)).toContainText('0000000000000000000000000000000000000000');
  await expect(output(page)).toContainText(intent);
  await expect(output(page).locator('img')).toHaveCount(0);
  await output(page).getByRole('link', { name: 'Inspect evidence GF001' }).click();
  await expect(page.locator('#evidence-GF001')).toBeFocused();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Markdown' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('review-subscription-change.md');
  expect(await readFile((await download.path())!, 'utf8')).toBe(data.markdown);
});

test('empty scenario is inspectable and explains 422 without a retry', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /No usable static evidence/ }).click();
  await expect(page.getByText('Empty result — no usable evidence')).toBeVisible();
  await generate(page).click();
  await expect(page.getByRole('alert')).toContainText('INSUFFICIENT_EVIDENCE');
  await expect(page.getByRole('alert')).toContainText('Empty results do not establish');
  await expect(page.getByRole('button', { name: 'Retry request' })).toHaveCount(0);
});

test('selecting the active scenario keeps its evidence and briefing available', async ({ page }) => {
  await ready(page); await generate(page).click(); await expect(output(page)).toBeVisible();
  await page.getByRole('button', { name: /Change subscription cancellation behavior/ }).click();
  await expect(output(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Impact at a glance' })).toBeVisible();
});

test('a pinned source URL is offered externally with original producer, confidence and lines', async ({ page }) => {
  const source = 'https://github.com/example/review-desk-fixture/blob/0000000000000000000000000000000000000000/src/shop/api/routes.py#L3';
  await page.route('**/cases/subscription-change', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.data.case.evidence[0].sourceUrl = source;
    await route.fulfill({ json: body });
  });
  await ready(page);
  const record = page.locator('#evidence-RG001');
  await expect(record).toContainText('repograph'); await expect(record).toContainText('confirmed');
  await expect(record).toContainText('src/shop/api/routes.py:3');
  await expect(record.getByRole('link')).toHaveAttribute('href', source);
  await expect(record.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
});

test('partial analysis remains usable and preserves all warnings in briefing and export', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: /Partial analysis with unresolved wiring/ }).click();
  await expect(page.getByText('Partial / unresolved evidence — inspect the warnings below')).toBeVisible();
  await expect(page.locator('#evidence-RG001')).toContainText('unresolved');
  await expect(page.locator('#evidence-GF001')).toContainText('INFERRED');
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/briefings'));
  await generate(page).click();
  const { data } = await (await responsePromise).json();
  const fixture = JSON.parse(await readFile(resolve('../fixtures/artifact-bundle.fixture.json'), 'utf8'));
  const selected = fixture.cases.find((item: { id: string }) => item.id === 'partial-analysis');
  for (const warning of [...selected.limitations, ...selected.impact.blindSpots]) {
    await expect(output(page)).toContainText(warning);
    expect(data.markdown).toContain(warning.replace(/[.!]/g, '\\$&'));
  }
});

for (const [control, code] of [['timeout', 'MODEL_TIMEOUT'], ['rate-limit', 'RATE_LIMITED'], ['invalid-response', 'INVALID_MODEL_OUTPUT']]) {
  test(`${code}: service retryable flag enables retry and retains intention`, async ({ page }) => {
    let failed = false;
    await page.route('**/api/v1/briefings', route => {
      if (!failed) { failed = true; return route.continue({ url: `${route.request().url()}?mock=${control}` }); }
      return route.continue();
    });
    await ready(page);
    await page.getByLabel('What are you intending to change?').fill('Keep this intention for retry');
    await generate(page).click();
    await expect(page.getByRole('alert')).toContainText(code);
    await expect(page.getByLabel('What are you intending to change?')).toHaveValue('Keep this intention for retry');
    await page.getByRole('button', { name: 'Retry request' }).click();
    await expect(output(page)).toBeVisible();
  });
}

test('503 shows a friendly explanation and never displays the provider message', async ({ page }) => {
  await page.route('**/api/v1/briefings', route => route.fulfill({ status: 503, json: { schemaVersion: '1.0.0', error: { code: 'MODEL_UNAVAILABLE', message: 'private-provider-diagnostic', retryable: true } } }));
  await ready(page); await generate(page).click();
  await expect(page.getByRole('alert')).toContainText('unavailable or is not configured');
  await expect(page.getByText('private-provider-diagnostic')).toHaveCount(0);
});

test('loading prevents duplicate submissions and a case switch cancels the old briefing', async ({ page }) => {
  let posts = 0;
  await page.route('**/api/v1/briefings', route => { posts++; return route.continue({ url: `${route.request().url()}?delayMs=1200` }); });
  await ready(page); await generate(page).click();
  await expect(page.getByRole('button', { name: 'Preparing briefing' })).toBeDisabled();
  await page.getByRole('button', { name: /No usable static evidence/ }).click();
  await expect(page.getByText('Empty result — no usable evidence')).toBeVisible();
  // Wait longer than the deliberately delayed old response to exercise stale-response protection.
  await page.waitForTimeout(1400);
  await expect(output(page)).toHaveCount(0);
  expect(posts).toBe(1);
});

test('late case response cannot replace the newly selected scenario', async ({ page }) => {
  await ready(page);
  await page.route('**/cases/partial-analysis', async route => {
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 800));
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: /Partial analysis with unresolved wiring/ }).click();
  await page.getByRole('button', { name: /No usable static evidence/ }).click();
  await expect(page.getByText('Empty result — no usable evidence')).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: 'No usable static evidence' })).toBeVisible();
});

test('live inference over fixture evidence keeps both dimensions visible', async ({ page }) => {
  await page.route('**/api/v1/briefings', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.mode = 'live'; body.data.model = 'test-model-simulated';
    await route.fulfill({ json: body });
  });
  await ready(page); await generate(page).click();
  await expect(output(page)).toContainText('Live inference');
  await expect(output(page)).toContainText('fixture');
  await expect(output(page)).toContainText('test-model-simulated');
  await expect(page.getByText('Analysis · Synthetic fixture')).toBeVisible();
});

test('wrong-case or invalid citations are rejected instead of being displayed', async ({ page }) => {
  await page.route('**/api/v1/briefings', async route => {
    const response = await route.fetch(); const body = await response.json();
    body.data.findings[0].evidenceIds = ['INVENTED'];
    await route.fulfill({ json: body });
  });
  await ready(page); await generate(page).click();
  await expect(page.getByRole('alert')).toContainText('INVALID_RESPONSE');
  await expect(output(page)).toHaveCount(0);
});

test('catalog failure supports retry, and case failure does not leave old evidence visible', async ({ page }) => {
  let fail = true;
  await page.route('**/catalog', route => fail ? route.abort() : route.continue());
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('NETWORK_ERROR');
  fail = false; await page.getByRole('button', { name: 'Retry request' }).click();
  await expect(page.getByRole('heading', { name: 'Impact at a glance' })).toBeVisible();
  await page.route('**/cases/empty-result', route => route.abort());
  await page.getByRole('button', { name: /No usable static evidence/ }).click();
  await expect(page.getByRole('alert')).toContainText('NETWORK_ERROR');
  await expect(page.locator('#evidence-RG001')).toHaveCount(0);
});

test('intent has a 500-character input limit and keyboard navigation reaches the workspace and evidence', async ({ page }) => {
  await ready(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to review workspace' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#workspace')).toBeFocused();
  const input = page.getByLabel('What are you intending to change?');
  await input.fill('x'.repeat(500));
  await expect(page.getByText('500/500')).toBeVisible();
  await expect(input).toHaveAttribute('maxlength', '500');
  await page.getByRole('link', { name: 'Inspect evidence RG001' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#evidence-RG001')).toBeFocused();
});

for (const width of [390, 1366]) {
  test(`responsive ${width}px: paths wrap, controls fit, no page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await ready(page);
    await generate(page).click(); await expect(output(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await mkdir(resolve('../deployment/screenshots'), { recursive: true });
    await page.screenshot({ path: resolve(`../deployment/screenshots/dashboard-${width}.png`), fullPage: true });
  });
}

test('production build never exposes local mock controls or appends verification queries', async ({ page }) => {
  await ready(page);
  await expect(page.getByText('Local mock verification')).toHaveCount(0);
  const requestPromise = page.waitForRequest(request => request.method() === 'POST');
  await generate(page).click();
  expect(new URL((await requestPromise).url()).search).toBe('');
});
