import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const dry = process.argv.includes('--dry');
const output = path.resolve('../artifacts/walkthrough');
const base = 'http://localhost:5173';
const font = await fs.readFile(
  'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
);
const bold = await fs.readFile(
  'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2',
);
await fs.mkdir(`${output}/raw`, { recursive: true });
await fs.mkdir(`${output}/preview`, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  locale: 'en-GB',
  timezoneId: 'Asia/Kolkata',
  acceptDownloads: true,
  ...(!dry ? { recordVideo: { dir: `${output}/raw`, size: { width: 1920, height: 1080 } } } : {}),
});
const started = performance.now();
const page = await context.newPage();
const video = page.video();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const report = { dry, scenes: [], callouts: [], errors, examples: [], width: 1920, height: 1080 };
let app;
let chapter = 0;
let mouse = { x: 1868, y: 1032 };
let currentScene;
const elapsed = () => (performance.now() - started) / 1000;
const pause = (ms) => page.waitForTimeout(ms);
const hold = (ms) => pause(dry ? Math.min(200, ms) : ms);
const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:TourMono;src:url(data:font/woff2;base64,${font.toString('base64')})} @font-face{font-family:TourMono;src:url(data:font/woff2;base64,${bold.toString('base64')});font-weight:600}
*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#09090a;color:#e6e6e6;font:16px TourMono,monospace}.window{position:absolute;left:48px;top:24px;width:1824px;border:1px solid #232325;border-radius:2px;overflow:hidden;background:#0d0d0e}.chrome{height:44px;background:#131314;border-bottom:1px solid #232325;display:flex;align-items:center;gap:16px;padding:0 16px;color:#8a8a8e}.window-controls{display:flex;gap:8px}.window-controls i{display:block;width:7px;height:7px;border:1px solid #55555a;border-radius:50%}.arrows{font-size:20px;color:#55555a;letter-spacing:8px}.address{border:1px solid #232325;background:#0d0d0e;flex:1;padding:5px 12px;font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.chrome b{font-size:11px;font-weight:400;letter-spacing:1px}.viewport{position:relative;width:1822px;height:984px;overflow:hidden}iframe{border:0;width:1600px;height:864px;transform:scale(1.13875);transform-origin:top left;background:#0d0d0e}.chapter{position:absolute;left:64px;bottom:8px;font-size:11px;color:#8a8a8e}.demo{position:absolute;right:64px;bottom:8px;font-size:10px;color:#55555a}.progress{position:absolute;bottom:0;left:48px;width:1824px;height:1px;background:#232325}.progress i{display:block;height:1px;background:#7aa2f7;width:0}.hud{pointer-events:none;position:fixed;inset:0;z-index:99999}.callout{position:absolute;width:430px;border:1px solid #232325;border-left:2px solid #7aa2f7;border-radius:2px;background:#131314;padding:16px 20px;opacity:0;transition:opacity 140ms linear}.callout.on{opacity:1}.callout .label{font-size:12px;color:#8a8a8e;text-transform:uppercase;margin-bottom:9px;letter-spacing:.7px}.callout h2{font-size:19px;line-height:1.45;font-weight:600;margin:0 0 8px}.callout p{font-size:16px;line-height:1.6;margin:0;color:#b5b5b9}.callout small{display:block;font-size:11px;line-height:1.5;margin-top:12px;color:#8a8a8e}.focus{position:absolute;border:1px solid #7aa2f7;border-radius:1px;opacity:0;transition:opacity 140ms linear}.focus.on{opacity:.85}.wire{position:absolute;inset:0;width:1920px;height:1080px}.wire path{fill:none;stroke:#7aa2f7;stroke-width:1;opacity:.7}.pointer{position:absolute;left:1868px;top:1032px;width:18px;height:24px;z-index:2;pointer-events:none}.click{position:absolute;width:20px;height:20px;border:1px solid #7aa2f7;border-radius:50%;opacity:0;transform:translate(-50%,-50%)}.click.on{opacity:.8}
</style></head><body><div class="window"><div class="chrome"><span class="window-controls"><i></i><i></i><i></i></span><span class="arrows">‹ ›</span><div class="address" id="address">localhost:5173</div><b>IOC FEED / GUIDED WALKTHROUGH</b></div><div class="viewport"><iframe name="ioc-app" title="IOC Feed application" src="${base}/"></iframe></div></div><div class="chapter" id="chapter">IOC FEED</div><div class="demo">LOCAL DEMO · SYNTHETIC IOC DATA · REPLAY SIMULATIONS ARE LABELED</div><div class="progress"><i id="progress"></i></div><div class="hud"><div class="focus" id="focus"></div><svg class="wire"><path id="wire" /></svg><div class="callout" id="callout"></div><svg class="pointer" id="pointer" viewBox="0 0 18 24"><path d="M2 1 L2 19 L7 14 L11 22 L14 20 L10 12 L17 12 Z" fill="#e6e6e6" stroke="#0d0d0e" stroke-width="1.5"/></svg><div class="click" id="click"></div></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
app = page.frame({ name: 'ioc-app' });
page.on('framenavigated', (frame) => {
  if (frame.name() === 'ioc-app')
    page
      .evaluate((url) => {
        document.querySelector('#address').textContent = url.replace(/^https?:\/\//, '');
      }, frame.url())
      .catch(() => {});
});
await app.locator('.archive-file-toggle').first().waitFor();
await app.waitForFunction(() => document.querySelector('.query-state')?.textContent === 'ready');
await app.locator('.indicators-panel tbody tr').first().waitFor();
await pause(450);
const leaders = await (await page.request.get('http://localhost:8000/api/graph/leaders')).json();
report.examples = leaders.items.slice(0, 3);
const [primary, secondary, third] = report.examples;

async function clearCallout() {
  await page.evaluate(() => {
    document.querySelector('#callout').classList.remove('on');
    document.querySelector('#focus').classList.remove('on');
    document.querySelector('#wire').setAttribute('d', '');
  });
  await pause(dry ? 0 : 150);
}
async function move(x, y) {
  const from = { ...mouse };
  const steps = dry ? 1 : 12;
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((x - from.x) * i) / steps, y: from.y + ((y - from.y) * i) / steps };
    await page.mouse.move(p.x, p.y);
    await page.evaluate((p) => {
      const el = document.querySelector('#pointer');
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
    }, p);
    if (!dry) await pause(18);
  }
  mouse = { x, y };
}
async function clickPoint(x, y) {
  await move(x, y);
  await page.evaluate(
    (p) => {
      const el = document.querySelector('#click');
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.classList.add('on');
    },
    { x, y },
  );
  await page.mouse.click(x, y);
  await pause(dry ? 20 : 170);
  await page.evaluate(() => document.querySelector('#click').classList.remove('on'));
}
async function click(locator, position) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  if (!r) throw new Error('Click target unavailable');
  await clickPoint(r.x + (position?.x ?? r.width / 2), r.y + (position?.y ?? r.height / 2));
}
async function type(locator, value, delay = 35) {
  await click(locator);
  await locator.fill('');
  await locator.pressSequentially(value, { delay: dry ? 0 : delay });
}
async function top() {
  await app.evaluate(() => globalThis.scrollTo({ top: 0, behavior: 'smooth' }));
  await pause(500);
}
async function scrollTo(locator) {
  await locator.scrollIntoViewIfNeeded();
  await pause(400);
}
async function nav(name, ready) {
  await clearCallout();
  await click(app.getByRole('link', { name, exact: true }).first());
  if (ready) await app.locator(ready).first().waitFor();
  await pause(250);
}
async function begin(title, prepare) {
  await clearCallout();
  await prepare?.();
  await pause(250);
  chapter++;
  currentScene = { title, start: elapsed(), end: null };
  report.scenes.push(currentScene);
  await page.evaluate(
    ({ chapter, title }) => {
      document.querySelector('#chapter').textContent =
        `${String(chapter).padStart(2, '0')} / ${title.toUpperCase()}`;
      document.querySelector('#progress').style.width = `${(chapter / 11) * 100}%`;
    },
    { chapter, title },
  );
}
function finish() {
  currentScene.end = elapsed();
}
async function note(
  label,
  title,
  text,
  target,
  { x = 1400, y = 360, width = 410, duration = 4600, footer = '' } = {},
) {
  let r = target ? await target.boundingBox() : null;
  if (r) {
    r = {
      x: Math.max(50, r.x - 5),
      y: Math.max(70, r.y - 5),
      width: Math.min(r.width + 10, 1820),
      height: Math.min(r.height + 10, 980),
    };
    if (r.x + r.width > 1869) r.width = 1869 - r.x;
    if (r.y + r.height > 1051) r.height = 1051 - r.y;
  }
  const start = elapsed();
  await page.evaluate(
    ({ label, title, text, r, x, y, width, footer }) => {
      const box = document.querySelector('#callout');
      box.style.cssText = `left:${x}px;top:${y}px;width:${width}px;`;
      box.innerHTML = `<div class="label">${label}</div><h2>${title}</h2><p>${text}</p>${footer ? `<small>${footer}</small>` : ''}`;
      box.classList.add('on');
      const focus = document.querySelector('#focus');
      if (r) {
        focus.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;`;
        focus.classList.add('on');
        const boxRect = box.getBoundingClientRect();
        const startX = x > r.x + r.width / 2 ? x : x + width;
        const startY = Math.max(y + 20, Math.min(boxRect.bottom - 20, r.y + r.height / 2));
        const endX = Math.max(r.x, Math.min(r.x + r.width, startX));
        const endY = Math.max(r.y, Math.min(r.y + r.height, startY));
        document.querySelector('#wire').setAttribute('d', `M${startX},${startY} L${endX},${endY}`);
      }
    },
    {
      label: escape(label),
      title: escape(title),
      text: escape(text),
      r,
      x,
      y,
      width,
      footer: escape(footer),
    },
  );
  await pause(180);
  const name = `${String(report.callouts.length + 1).padStart(2, '0')}-${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
  await page.screenshot({ path: `${output}/preview/${name}.png` });
  await hold(Math.max(5200, duration * 1.2));
  report.callouts.push({
    label,
    title,
    text,
    footer,
    start,
    end: elapsed(),
    scene: chapter,
    target: r,
    box: { x, y, width },
  });
  await clearCallout();
}
async function graphNode() {
  const canvas = app.locator('.graph-stage canvas').first();
  const hit = await canvas.evaluate((c) => {
    const { width, height } = c;
    const d = c.getContext('2d').getImageData(0, 0, width, height).data;
    for (let y = 25; y < height - 50; y++)
      for (let x = 20; x < width - 20; x++) {
        const i = (y * width + x) * 4;
        if (
          Math.abs(d[i] - 138) < 3 &&
          Math.abs(d[i + 1] - 138) < 3 &&
          Math.abs(d[i + 2] - 142) < 3 &&
          Math.hypot(x - width / 2, y - height / 2) > 60
        )
          return { x: x / width, y: (y + 2) / height };
      }
    throw new Error('No graph node pixels found');
  });
  const rect = await canvas.boundingBox();
  await clickPoint(rect.x + hit.x * rect.width, rect.y + hit.y * rect.height);
}
try {
  await begin('Atlas · browse the dataset');
  await note(
    'ATLAS',
    'Start with the local dataset',
    'Browse 1.31 million demo IOCs by date, type, family, source and infrastructure.',
    app.locator('.explore-header p'),
    {
      x: 1370,
      y: 180,
      width: 440,
      duration: 4300,
      footer: 'Real app interactions · demo records are synthetic',
    },
  );
  await click(app.locator('.archive-file-toggle').last(), { x: 140, y: 16 });
  await app.locator('.archive-year-grid button').first().waitFor();
  await note(
    'YEAR ARCHIVE',
    'Open a year to see daily activity',
    'Each square represents one day. The month labels and intensity shades make activity easy to scan.',
    app.locator('.archive-year-calendar'),
    { x: 1390, y: 375, width: 420, duration: 4400 },
  );
  const day = app.locator('.archive-year-grid button:not([aria-label$=": 0 indicators"])').nth(140);
  await click(day);
  await app.locator('.archive-result').first().waitFor();
  await scrollTo(app.locator('.archive-results'));
  await note(
    'DAY DRILL-DOWN',
    'A day opens its actual IOC list',
    'Inspect the records for that day, page through them, or open an IOC for more context.',
    app.locator('.archive-results'),
    { x: 1390, y: 250, width: 420, duration: 4300 },
  );
  finish();

  await begin('Filters · collections and pivots', async () => {
    await app.goto(base + '/', { waitUntil: 'networkidle' });
    await app.locator('.facet-panel').first().waitFor();
  });
  await scrollTo(app.locator('#families'));
  await click(app.locator('#families .facet-main').first());
  await app.waitForFunction(() => document.querySelector('.query-state')?.textContent === 'ready');
  await note(
    'FACET FILTERS',
    'Narrow the entire workspace',
    'Select a malware family to update counts, date activity and matching records together.',
    app.locator('#families'),
    { x: 1350, y: 300, width: 460, duration: 4300 },
  );
  await click(app.locator('#families .row-more').first());
  await app.locator('.collection-table tbody tr').first().waitFor();
  await top();
  await note(
    'COLLECTIONS',
    'Keep context as you drill down',
    'Collections group related records and offer pivots into sources, actors, tags and individual IOC records.',
    app.locator('.record-header'),
    { x: 1370, y: 400, width: 440, duration: 4300 },
  );
  finish();

  await begin('Search · a connected IOC', async () => {
    await nav('Search', '#command');
    await top();
  });
  await app.locator('#command').press('Control+k');
  await type(app.getByLabel('IOC search'), primary.value, 65);
  await app.getByRole('button', { name: `${primary.value} ipv4`, exact: true }).waitFor();
  await note(
    'IOC LOOKUP',
    'Jump straight to a known indicator',
    'Search an IP, domain, URL or hash. Ctrl+K returns focus to the lookup field.',
    app.locator('main form'),
    { x: 1370, y: 270, width: 440, duration: 4200 },
  );
  // Submit an actual lookup so the local recent-lookups feature also records it.
  await click(app.getByRole('button', { name: 'lookup', exact: true }));
  await app.locator('.decision-block').waitFor();
  await note(
    'IOC RECORD',
    'See the decision and supporting evidence',
    'Review the verdict, confidence, freshness and source observations before following relationships.',
    app.locator('.decision-block'),
    { x: 1350, y: 590, width: 460, duration: 4500 },
  );
  finish();

  await begin('Evidence · inspect the source');
  await scrollTo(app.locator('.evidence-list'));
  await click(app.locator('.evidence-list a').first());
  await app.getByRole('heading', { name: 'Normalized source record', exact: true }).waitFor();
  await note(
    'SOURCE EVIDENCE',
    'Read the stored observation',
    'Normalized fields, raw JSON and attribution explain where a claim came from. This example is explicitly synthetic.',
    app.locator('.evidence-fields'),
    { x: 1350, y: 360, width: 460, duration: 4800 },
  );
  finish();

  await begin('Graph · explicit relationships', async () => {
    await nav('Graph', '.graph-leader-row');
    await top();
  });
  await note(
    'CONNECTED STARTING POINTS',
    'Choose an IOC with a rich neighbourhood',
    'These three infrastructure IOCs each have 200 direct stored relationships.',
    app.locator('.graph-leaders'),
    { x: 1370, y: 600, width: 440, duration: 4000 },
  );
  await click(app.locator('.graph-leader-row').first().locator('a').first());
  await app.locator('.graph-stage canvas').first().waitFor();
  await pause(2000);
  await click(app.getByLabel('Close detail'));
  await pause(650);
  await note(
    'RELATIONSHIP GRAPH',
    'Explore a centred neighbourhood',
    'Shapes distinguish IOC types. Directed edges are explicit stored relationships. Rendering stays capped at 250 nodes.',
    app.locator('.graph-stage'),
    { x: 1400, y: 780, width: 410, duration: 4500 },
  );
  await graphNode();
  await app.locator('.graph-detail-panel').waitFor();
  await app
    .locator('.graph-path-message')
    .getByText(/hops in the stored path/)
    .waitFor();
  await pause(1000);
  await note(
    'NODE INTERACTION',
    'A click follows the evidence',
    'Clicking a node opens its details and loads neighbours. Selecting another highlights their shortest stored path.',
    app.locator('.graph-detail-panel'),
    { x: 320, y: 180, width: 470, duration: 4600 },
  );
  await click(app.getByRole('checkbox', { name: 'url', exact: true }));
  await pause(500);
  await click(app.getByRole('checkbox', { name: 'url', exact: true }));
  await click(app.getByRole('button', { name: 'fit', exact: true }));
  await pause(400);
  finish();

  await begin('Replay · captured evidence over time', async () => {
    await nav('Replay', '.replay-pick');
    await click(app.locator('.replay-pick').first());
    await app.locator('.replay-confidence-chart').waitFor();
    await top();
  });
  await note(
    'EVIDENCE REPLAY',
    'Compare what was captured then with now',
    'The timeline shows stored confidence at each capture. Earlier walkthrough stages are clearly marked simulated.',
    app.locator('.replay-timeline'),
    { x: 1370, y: 690, width: 440, duration: 4800 },
  );
  const range = app.getByLabel('Evidence capture', { exact: true });
  await click(range, { x: 10, y: 8 });
  await range.press('Home');
  await pause(250);
  await range.press('ArrowRight');
  await pause(dry ? 0 : 450);
  await range.press('ArrowRight');
  await pause(550);
  await scrollTo(app.locator('.replay-visual-grid'));
  await note(
    'SOURCE ORIGINS',
    'Two mentions can share one origin',
    'Source-presence lanes show when each mention appears. Mirrored reports are grouped by their declared upstream origin.',
    app.locator('.replay-origin-summary'),
    { x: 330, y: 170, width: 570, duration: 4900 },
  );
  await note(
    'RELATIONSHIP CHANGES',
    'See the evidence graph grow',
    'Matching positions make comparison easy. Faint nodes are absent in the selected capture; blue links were added later.',
    app.locator('.replay-miniatures'),
    { x: 330, y: 360, width: 570, duration: 4700 },
  );
  finish();

  await begin('Another investigation · same workflow', async () => {
    await nav('Replay', '.replay-pick');
    await click(app.locator('.replay-pick').nth(1));
    await app.locator('.replay-confidence-chart').waitFor();
    await top();
  });
  await app.getByLabel('Evidence capture', { exact: true }).fill('1');
  await pause(500);
  await note(
    'SECOND CONNECTED IOC',
    secondary.value,
    'Repeat the same capture-to-current comparison for another IOC with 200 direct relationships.',
    app.locator('.replay-comparison'),
    { x: 1370, y: 680, width: 440, duration: 3900 },
  );
  finish();

  await begin('Bulk triage · review and export', async () => {
    await nav('Bulk', '#bulk-input');
    await top();
  });
  await type(
    app.getByLabel('input / CSV or text'),
    `${primary.value}\n${secondary.value}\n${third.value}\nnot-an-ioc`,
    15,
  );
  await click(app.getByRole('button', { name: 'run triage', exact: true }));
  await app.getByText('4 checked', { exact: false }).waitFor();
  await note(
    'BULK TRIAGE',
    'Check a list in one pass',
    'Paste text or drop a CSV, compare verdicts and confidence, then inspect any matching IOC.',
    app.locator('main table'),
    { x: 1370, y: 630, width: 440, duration: 4300 },
  );
  await click(app.getByRole('button', { name: /3 malicious/ }));
  const download = page.waitForEvent('download');
  await click(app.getByRole('link', { name: 'export csv', exact: true }));
  const saved = await download;
  await saved.saveAs(`${output}/production/bulk-triage-example.csv`);
  await note(
    'EXPORTS',
    'Take the results into your workflow',
    'Export CSV, JSON or a blocklist. The CSV download shown here comes from this real four-input triage.',
    app.getByRole('link', { name: 'export csv', exact: true }),
    { x: 1370, y: 600, width: 440, duration: 3800, footer: `Saved: ${saved.suggestedFilename()}` },
  );
  finish();

  await begin('Map · geography and observation time', async () => {
    await nav('Map', 'svg[aria-label="Equirectangular map of indicator locations"]');
    await top();
    await app
      .locator('svg[aria-label="Equirectangular map of indicator locations"] circle')
      .first()
      .waitFor();
  });
  await note(
    'GEOGRAPHY',
    'Inspect the IOCs with location data',
    'The flat map and country/ASN tables show geographic context for located IPs. Demo coordinates are labeled synthetic.',
    app.getByRole('img', { name: 'Equirectangular map of indicator locations' }),
    { x: 1340, y: 700, width: 470, duration: 4500 },
  );
  await app.locator('main select').selectOption({ label: 'Emotet' });
  const mapRange = app.getByLabel('Timeline position');
  await mapRange.fill('100');
  await pause(700);
  await click(mapRange, { x: Math.round((await mapRange.boundingBox()).width * 0.8), y: 9 });
  await click(app.getByRole('button', { name: 'play', exact: true }));
  await pause(dry ? 150 : 700);
  await click(app.getByRole('button', { name: 'pause', exact: true }));
  await note(
    'TIME + FAMILY FILTERS',
    'Scrub or play the observation timeline',
    'The date slider and family selector narrow the displayed observations. The leaderboards follow the visible points.',
    app.locator('.panel').last(),
    { x: 1370, y: 420, width: 440, duration: 4200 },
  );
  finish();

  await begin('Feeds · source and import history', async () => {
    await nav('Feeds', 'main table tbody tr');
    await top();
  });
  await note(
    'FEEDS + INGESTION LOG',
    'Check source coverage and import activity',
    'See source counts, last sync times and timestamped import logs. Continuous ingestion is disabled for this local demo.',
    app.locator('main .panel').first(),
    { x: 1390, y: 590, width: 420, duration: 4500 },
  );
  finish();

  await begin('Follow one IOC from lookup to evidence', async () => {
    await nav('Graph', '.graph-leader-row');
    await click(app.locator('.graph-leader-row').nth(1).locator('a').first());
    await app.locator('.graph-stage canvas').first().waitFor();
    await pause(1800);
    await click(app.getByLabel('Close detail'));
    await pause(500);
  });
  await note(
    'IOC FEED',
    'Search. Inspect. Connect. Replay.',
    'A local workspace for exploring IOC evidence, following explicit relationships and comparing captured states.',
    null,
    {
      x: 1110,
      y: 785,
      width: 700,
      duration: 4700,
      footer: '1,310,000 synthetic demo IOCs · 923,999 stored relationships',
    },
  );
  finish();
  await clearCallout();
  await hold(400);
  report.finished = elapsed();
  report.consoleErrors = errors;
  if (errors.length) throw new Error(errors.join('\n'));
} catch (error) {
  report.failure = error.stack;
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  if (currentScene && !currentScene.end) currentScene.end = elapsed();
  await fs.writeFile(`${output}/${dry ? 'dry-run' : 'edit'}.json`, JSON.stringify(report, null, 2));
  await context.close();
  if (video) {
    report.rawVideo = await video.path();
    await fs.writeFile(`${output}/edit.json`, JSON.stringify(report, null, 2));
  }
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      dry,
      scenes: report.scenes.length,
      callouts: report.callouts.length,
      duration: report.finished,
      rawVideo: report.rawVideo,
      failure: report.failure,
      consoleErrors: errors,
    },
    null,
    2,
  ),
);
