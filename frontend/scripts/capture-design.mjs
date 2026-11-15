import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = 'http://localhost:5173';
const output = '../artifacts/design-review';
const views = [
  ['lookup', '/'],
  ['graph-detail', '/investigate/5'],
  ['dashboard', '/dashboard'],
  ['bulk', '/bulk'],
  ['geo-timeline', '/geo'],
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
  colorScheme: 'dark',
});

const consoleErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => consoleErrors.push(error.message));

for (const [name, route] of views) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  if (name === 'bulk') {
    await page
      .getByPlaceholder('one indicator per line')
      .fill('10.0.0.1\nnode-2.malware-test.example\nnot-an-ioc');
    await page.getByRole('button', { name: 'run triage' }).click();
    await page.locator('tbody tr').first().waitFor();
  }
  if (name === 'graph-detail') await page.waitForTimeout(700);

  const violations = await page.evaluate(() => {
    const found = [];
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      const radius = Math.max(
        parseFloat(style.borderTopLeftRadius) || 0,
        parseFloat(style.borderTopRightRadius) || 0,
        parseFloat(style.borderBottomLeftRadius) || 0,
        parseFloat(style.borderBottomRightRadius) || 0,
      );
      if (style.backgroundImage !== 'none') found.push(`background-image:${element.tagName}`);
      if (style.boxShadow !== 'none') found.push(`box-shadow:${element.tagName}`);
      if (style.filter !== 'none') found.push(`filter:${element.tagName}`);
      if (style.backdropFilter && style.backdropFilter !== 'none')
        found.push(`backdrop-filter:${element.tagName}`);
      if (radius > 2.1) found.push(`radius-${radius}:${element.tagName}`);
      if (style.animationName !== 'none') found.push(`animation:${element.tagName}`);
    }
    return [...new Set(found)];
  });

  if (violations.length) throw new Error(`${name} ban violations: ${violations.join(', ')}`);
  await page.screenshot({ path: `${output}/${name}-1440x900.png`, fullPage: false });
  process.stdout.write(`${name}: screenshot captured, ban audit passed\n`);
}

await browser.close();
if (consoleErrors.length) throw new Error(`browser console errors:\n${consoleErrors.join('\n')}`);
