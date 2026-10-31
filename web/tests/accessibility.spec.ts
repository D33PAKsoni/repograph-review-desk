import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AxeResults } from 'axe-core';

for (const width of [390, 1366]) {
  test(`WCAG A/AA audit: initial, briefing, partial, empty and error states at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Impact at a glance' })).toBeVisible();
    const reports: { state: string; width: number; violations: AxeResults['violations']; incomplete: AxeResults['incomplete']; passedRules: number }[] = [];
    async function audit(state: string) {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      reports.push({ state, width, violations: result.violations, incomplete: result.incomplete, passedRules: result.passes.length });
      return result.violations.map(item => ({ rule: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, reason: node.failureSummary })) }));
    }
    const violations: unknown[] = [];
    violations.push(...await audit('ready'));
    await page.getByRole('button', { name: 'Generate briefing' }).click();
    await expect(page.getByRole('article', { name: 'Generated briefing' })).toBeVisible();
    violations.push(...await audit('briefing'));
    await page.getByRole('button', { name: /Partial analysis with unresolved wiring/ }).click();
    await expect(page.getByText('Partial / unresolved evidence — inspect the warnings below')).toBeVisible();
    violations.push(...await audit('partial'));
    await page.getByRole('button', { name: /No usable static evidence/ }).click();
    await expect(page.getByText('Empty result — no usable evidence')).toBeVisible();
    violations.push(...await audit('empty'));
    await page.getByRole('button', { name: 'Generate briefing' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    violations.push(...await audit('error'));
    await mkdir(resolve('../deployment/verification'), { recursive: true });
    await writeFile(resolve(`../deployment/verification/accessibility-${width}.json`), `${JSON.stringify(reports, null, 2)}\n`);
    expect(violations).toEqual([]);
  });
}
