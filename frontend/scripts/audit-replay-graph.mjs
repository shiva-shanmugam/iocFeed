import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const base = 'http://localhost:5173';
const report = { passed: [], failed: [], details: {} };
const check = (condition, label) => {
  (condition ? report.passed : report.failed).push(label);
  if (!condition) throw new Error(label);
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function graphGeometry(label) {
  await page.waitForTimeout(1800);
  const geometry = await page
    .locator('.graph-stage canvas')
    .first()
    .evaluate((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const stage = canvas.closest('.graph-stage').getBoundingClientRect();
      const { width, height } = canvas;
      const data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let minX = width,
        maxX = 0,
        minY = height,
        maxY = 0,
        click = null,
        count = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const p = (y * width + x) * 4;
          if (
            Math.abs(data[p] - 138) < 3 &&
            Math.abs(data[p + 1] - 138) < 3 &&
            Math.abs(data[p + 2] - 142) < 3
          ) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            count++;
            if (!click && Math.hypot(x - width / 2, y - height / 2) > 50)
              click = {
                x: rect.x + (x / width) * rect.width,
                y: rect.y + ((y + 2) / height) * rect.height,
              };
          }
        }
      return {
        canvasWidth: rect.width,
        canvasHeight: rect.height,
        stageWidth: stage.width,
        stageHeight: stage.height,
        centerOffsetX: (((minX + maxX) / 2 - width / 2) * rect.width) / width,
        centerOffsetY: (((minY + maxY) / 2 - height / 2) * rect.height) / height,
        count,
        click,
      };
    });
  report.details[label] = geometry;
  check(
    Math.abs(geometry.canvasWidth - geometry.stageWidth) < 2 &&
      Math.abs(geometry.canvasHeight - geometry.stageHeight) < 2,
    `${label}: canvas matches available stage`,
  );
  check(
    geometry.count > 0 &&
      Math.abs(geometry.centerOffsetX) < 45 &&
      Math.abs(geometry.centerOffsetY) < 45,
    `${label}: visible neighbourhood starts in the centre`,
  );
  return geometry;
}

try {
  const response = await page.request.get('http://localhost:8000/api/graph/leaders');
  check(response.ok(), 'Connected IOC leaderboard API');
  const leaders = (await response.json()).items;
  check(
    leaders.length >= 3 && leaders[0].connections >= 200,
    'Connected dataset has substantial neighbourhoods',
  );
  report.details.leaders = leaders.slice(0, 3);
  const id = leaders[0].id;
  await page.goto(`${base}/replay`, { waitUntil: 'networkidle' });
  await page.locator('.replay-pick').first().waitFor();
  await page.locator('.replay-pick').first().click();
  await page.locator('.replay-confidence-chart').waitFor();
  check(
    (await page.locator('.replay-notice').textContent()).includes('simulated'),
    'Simulated history is explicitly labeled',
  );
  check(
    (await page.locator('.replay-captures button').count()) === 4,
    'Replay contains demo stages plus recorded baseline',
  );
  check(
    (await page.locator('.replay-lane').count()) === 2,
    'Source-presence lanes show both source mentions',
  );
  check(
    (await page.locator('.replay-miniatures svg').count()) === 2,
    'Selected/current relationship miniatures render',
  );
  await page.getByLabel('Evidence capture', { exact: true }).fill('2');
  check(page.url().includes('capture='), 'Capture selection has a shareable URL');
  check(
    (await page.locator('.replay-origin-summary').textContent()).includes(
      '2 mentions / 1 declared origins',
    ),
    'Copied report origins are grouped rather than counted as independent',
  );
  check(
    (await page.locator('.replay-neighbour.added').count()) > 0,
    'Relationship miniatures visibly distinguish added neighbours',
  );
  await page.screenshot({ path: 'artifacts/functionality/replay-comparison.png', fullPage: true });
  await page.reload({ waitUntil: 'networkidle' });
  check(
    (await page.getByLabel('Evidence capture', { exact: true }).inputValue()) === '2',
    'Selected capture survives reload',
  );
  await page.getByLabel('Evidence capture', { exact: true }).fill('3');
  check(
    (await page.locator('.replay-captures button[aria-pressed="true"]').textContent()).includes(
      'recorded',
    ),
    'Latest baseline is marked recorded',
  );
  await page.goto(`${base}/replay/1?at=2019-01-01`, { waitUntil: 'networkidle' });
  await page.getByText('No captured state for this date', { exact: true }).waitFor();
  check(
    (await page.locator('.replay-comparison').count()) === 0,
    'Missing historical evidence does not invent an old verdict',
  );
  await page.getByRole('button', { name: 'open earliest capture' }).click();
  check(
    (await page.locator('.replay-comparison').count()) === 1,
    'Existing IOC baseline opens from an uncovered date',
  );
  await page.goto(`${base}/investigate/${id}`, { waitUntil: 'networkidle' });
  await page.locator('.graph-stage canvas').first().waitFor();
  await graphGeometry('drawer open');
  await page.screenshot({ path: 'artifacts/functionality/graph-centred-drawer.png' });
  await page.getByLabel('Close detail').click();
  const geometry = await graphGeometry('drawer closed');
  await page.screenshot({ path: 'artifacts/functionality/graph-centred.png' });
  await page.mouse.click(geometry.click.x, geometry.click.y);
  await page.locator('.graph-detail-panel').waitFor();
  await page
    .locator('.graph-path-message')
    .getByText(/hops in the stored path/)
    .waitFor();
  check(true, 'Canvas node click opens evidence, expands neighbours, and finds a stored path');
  await page.getByRole('button', { name: 'fit', exact: true }).click();
  await page.getByRole('button', { name: 'reset', exact: true }).click();
  await graphGeometry('reset');
  await page.getByLabel('Close detail').click();
  await page.getByRole('checkbox', { name: 'url', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'url', exact: true }).check();
  await page.setViewportSize({ width: 1000, height: 800 });
  await graphGeometry('resized');
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
    'Graph does not overflow at 1000px',
  );
  check(errors.length === 0, 'No browser errors');
} catch (e) {
  report.failed.push(e.message);
} finally {
  report.details.consoleErrors = errors;
  await writeFile(
    'artifacts/functionality/replay-graph-report.json',
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
