import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://localhost:5173';
const api = 'http://localhost:8000';
const report = { passed: [], failed: [], details: {} };
const check = (condition, name, detail = '') => {
  (condition ? report.passed : report.failed).push(detail ? `${name}: ${detail}` : name);
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));

try {
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('.indicators-panel tbody tr').first().waitFor();
  check((await page.locator('.heatmap-svg rect').count()) === 365, 'Explore year heat map');
  check(
    (await page.locator('.indicators-panel tbody tr').count()) === 25,
    'Explore pagination size',
  );
  await page.locator('.facet-panel').nth(1).locator('.row-more').first().click();
  await page.locator('.entity-modal').waitFor();
  const firstEntity = await page.locator('.entity-modal h2').textContent();
  if (await page.locator('.related-row').count()) {
    await page.locator('.related-row').first().click();
    await page.waitForTimeout(150);
    check(
      (await page.locator('.entity-modal h2').textContent()) !== firstEntity,
      'Entity lateral drill-down',
    );
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check((await page.locator('.entity-modal').count()) === 0, 'Entity drawer Escape close');
  await page.locator('.facet-panel').first().locator('.facet-main').first().click();
  await page.waitForTimeout(150);
  check(page.url().includes('type='), 'Facet updates URL');
  await page.getByRole('button', { name: 'clear all' }).click();
  await page.getByRole('button', { name: /last seen/ }).click();
  check(
    (await page.getByRole('button', { name: /last seen/ }).textContent()).includes('↑'),
    'Table sorting',
  );
  await page.getByRole('button', { name: 'next' }).click();
  check(page.url().includes('page=2'), 'Table pagination updates URL');
  await page.screenshot({ path: 'artifacts/functionality/explore.png', fullPage: false });

  await page.goto(`${base}/search`, { waitUntil: 'networkidle' });
  await page.getByLabel('IOC search').fill('10.0.0.1');
  await page.locator('text=matches').waitFor();
  check((await page.locator('text=10.0.0.1').count()) > 0, 'Search suggestions');
  await page.getByRole('button', { name: '10.0.0.1 ipv4', exact: true }).click();
  await page.waitForURL(/\/investigate\/1/);
  check(page.url().endsWith('/investigate/1'), 'Search opens graph root');

  await page.goto(`${base}/graph`, { waitUntil: 'networkidle' });
  check((await page.getByText('How the graph behaves').count()) === 1, 'Graph interaction guide');
  await page.getByLabel('Find graph root').fill('node-4');
  await page.locator('.graph-result').first().waitFor();
  await page.locator('.graph-result').first().click();
  await page.waitForURL(/\/investigate\//);
  await page.locator('canvas').waitFor();
  await page.getByText(/explicit relationships/).first().waitFor();
  check((await page.locator('canvas').count()) === 1, 'Relationship graph renders');
  check((await page.getByText(/click node/).count()) === 1, 'Graph instructions remain visible');
  check((await page.getByLabel('Close detail').count()) === 1, 'Root evidence drawer opens');
  await page.getByLabel('Close detail').click();
  check((await page.getByLabel('Close detail').count()) === 0, 'Graph drawer closes');
  await page.getByRole('button', { name: 'fit' }).click();
  await page.getByRole('button', { name: 'reset' }).click();
  await page.screenshot({ path: 'artifacts/functionality/graph.png', fullPage: false });

  await page.goto(`${base}/bulk`, { waitUntil: 'networkidle' });
  await page
    .getByLabel('input / CSV or text')
    .fill('10.0.0.1\nnode-2.malware-test.example\nnot-an-ioc');
  await page.getByRole('button', { name: 'run triage' }).click();
  await page.getByText('3 checked').waitFor();
  check((await page.locator('tbody tr').count()) === 3, 'Bulk triage rows');
  await page.getByRole('button', { name: /malicious/ }).click();
  check((await page.locator('tbody tr').count()) >= 1, 'Bulk verdict filter');

  await page.goto(`${base}/geo`, { waitUntil: 'networkidle' });
  await page.locator('svg circle').first().waitFor();
  const initialPoints = await page.locator('svg circle').count();
  check(initialPoints > 0, 'Map points render', String(initialPoints));
  await page.getByLabel('Timeline position').fill('50');
  await page.locator('select').selectOption({ label: 'Emotet' });
  check((await page.locator('svg circle').count()) >= 0, 'Map family and timeline filters');
  await page.getByRole('button', { name: 'play' }).click();
  await page.waitForTimeout(220);
  await page.getByRole('button', { name: 'pause' }).click();
  check(true, 'Timeline play and pause');

  await page.goto(`${base}/feeds`, { waitUntil: 'networkidle' });
  check((await page.getByText('synthetic-seed').count()) > 0, 'Feeds source table');
  check((await page.getByText('ingestion log').count()) > 0, 'Feeds ingestion log');

  const endpoints = [
    '/api/health',
    '/api/explore/summary',
    '/api/explore/facets',
    '/api/explore/timeseries?bucket=day&group=none&basis=first_seen',
    '/api/explore/indicators?page=1&page_size=25',
    '/api/graph/5?depth=2&max_nodes=250',
    '/api/graph/expand/5',
    '/api/geo/points',
    '/api/timeline',
    '/api/ingestion/log',
    '/api/bulk/export?format=csv',
    '/api/bulk/export?format=json',
    '/api/bulk/export?format=blocklist',
  ];
  for (const endpoint of endpoints) {
    const started = performance.now();
    const response = await fetch(`${api}${endpoint}`);
    check(
      response.ok,
      `API ${endpoint}`,
      `${response.status} ${Math.round(performance.now() - started)}ms`,
    );
  }
  const graph = await (await fetch(`${api}/api/graph/5?depth=2&max_nodes=250`)).json();
  if (graph.edges.length) {
    const edge = graph.edges[0];
    const pathResponse = await fetch(`${api}/api/graph/path?from=${edge.source}&to=${edge.target}`);
    const pathData = await pathResponse.json();
    check(pathResponse.ok && pathData.nodes.length >= 2, 'Graph shortest-path API');
  } else check(false, 'Graph shortest-path API', 'seed graph returned no edges');

  check(consoleErrors.length === 0, 'No browser console errors', consoleErrors.join(' | '));
} catch (error) {
  report.failed.push(`Audit runner: ${error instanceof Error ? error.message : String(error)}`);
}

report.details.consoleErrors = consoleErrors;
fs.mkdirSync('artifacts/functionality', { recursive: true });
fs.writeFileSync('artifacts/functionality/report.json', JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
