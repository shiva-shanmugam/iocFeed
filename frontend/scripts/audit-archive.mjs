import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'artifacts/functionality';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { passed: [], failed: [], samples: 0 };
const check = (condition, message) => (condition ? report.passed : report.failed).push(message);

// Observe every animation frame, including the loading state between a click and its results.
async function startSampling(change = 'steady') {
  await page.evaluate((change) => {
    const positions = () =>
      [...document.querySelectorAll('.archive-folder')].map((file) => {
        const rect = file.getBoundingClientRect();
        return { year: file.dataset.year, y: rect.y + globalThis.scrollY, height: rect.height };
      });
    const baseline = positions();
    const selectedIndex = [...document.querySelectorAll('.archive-folder')].findIndex((file) =>
      file.classList.contains('selected'),
    );
    const panelHeight = () => {
      const panel = document.querySelector('.archive-results');
      if (!panel) return 0;
      const style = getComputedStyle(panel);
      return (
        panel.getBoundingClientRect().height +
        parseFloat(style.marginTop) +
        parseFloat(style.marginBottom)
      );
    };
    const initialPanelHeight = panelHeight();
    const cells = [...document.querySelectorAll('.archive-year-grid button')];
    const heatmapPositions = cells.map((cell) => {
      const rect = cell.getBoundingClientRect();
      return { x: rect.x + globalThis.scrollX, y: rect.y + globalThis.scrollY };
    });
    const audit = { running: true, frames: 0, errors: [], transitions: 0, changed: false };
    globalThis.archiveMotionAudit = audit;
    const sample = () => {
      if (!audit.running) return;
      audit.frames++;
      const currentPanelHeight = panelHeight();
      const changed =
        change === 'expand'
          ? currentPanelHeight > 0
          : change === 'collapse'
            ? currentPanelHeight === 0
            : false;
      const delta =
        change === 'expand'
          ? currentPanelHeight
          : change === 'collapse' && changed
            ? -initialPanelHeight
            : 0;
      if (changed !== audit.changed) {
        audit.transitions++;
        audit.changed = changed;
      }
      positions().forEach((file, index) => {
        const expectedY = baseline[index].y + (index > selectedIndex ? delta : 0);
        const expectedHeight = baseline[index].height + (index === selectedIndex ? delta : 0);
        if (Math.abs(file.y - expectedY) > 0.5 || Math.abs(file.height - expectedHeight) > 0.5) {
          audit.errors.push(`File ${file.year} moved beyond the expected IOC section ${change}`);
        }
      });
      for (const [index, cell] of cells.entries()) {
        const rect = cell.getBoundingClientRect();
        if (
          Math.abs(rect.x + globalThis.scrollX - heatmapPositions[index].x) > 0.5 ||
          Math.abs(rect.y + globalThis.scrollY - heatmapPositions[index].y) > 0.5
        ) {
          audit.errors.push('A heatmap cell moved during a day selection or clearing');
          break;
        }
        if (rect.y > 0 && rect.bottom < globalThis.innerHeight) {
          if (
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) !== cell
          ) {
            audit.errors.push('A heatmap cell was covered during a click');
            break;
          }
        }
      }
      globalThis.requestAnimationFrame(sample);
    };
    globalThis.requestAnimationFrame(sample);
  }, change);
}

async function stopSampling(label, expectedTransitions = 0) {
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => {
    globalThis.archiveMotionAudit.running = false;
    return globalThis.archiveMotionAudit;
  });
  report.samples += result.frames;
  check(
    result.errors.length === 0 && result.transitions === expectedTransitions,
    `${label}: heatmap stayed fixed with ${expectedTransitions} expected layout transition (${result.frames} frames)`,
  );
  report.failed.push(...new Set(result.errors));
}

try {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.locator('.archive-file-toggle').first().waitFor();
  check((await page.locator('.archive-folder.selected').count()) === 0, 'All files start closed');
  check((await page.locator('.archive-folder-tab').count()) === 0, 'No folder tabs');
  const years = await page
    .locator('.archive-folder')
    .evaluateAll((files) => files.map((file) => file.dataset.year));

  for (const year of years) {
    const file = page.locator(`.archive-folder[data-year="${year}"]`);
    const button = file.locator('.archive-file-toggle');
    // Click blank space away from the year label: the entire file must respond.
    await button.click({ position: { x: 120, y: 16 } });
    check(
      (await button.getAttribute('aria-expanded')) === 'true',
      `${year}: file body opens the year`,
    );
    const yearOnRight = await button.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const label = element.querySelector('.archive-folder-year').getBoundingClientRect();
      return label.x > bounds.x + bounds.width / 2;
    });
    check(yearOnRight, `${year}: year is on the right`);
    await file.locator('.archive-year-calendar').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    check(
      (await file.locator('.archive-results').count()) === 0,
      `${year}: no IOC section before selecting a day`,
    );
    const compactHeight = await file.evaluate((element) => element.getBoundingClientRect().height);
    if (year === years[0]) await page.screenshot({ path: `${output}/explore-year-open.png` });
    const cells = file.locator('.archive-year-grid button:not([aria-label$=": 0 indicators"])');
    for (const day of [0, 1, 2]) {
      await startSampling(day === 0 ? 'expand' : 'steady');
      await cells.nth(day).click();
      await file.locator('.archive-result').first().waitFor();
      await stopSampling(`${year}, day ${day + 1}`, day === 0 ? 1 : 0);
      if (day === 0) {
        check(
          await file.locator('.archive-results').isVisible(),
          `${year}: selecting a day reveals the IOC section`,
        );
        check(
          (await file.evaluate((element) => element.getBoundingClientRect().height)) >
            compactHeight,
          `${year}: file expands only after selecting a day`,
        );
        if (year === years[0]) await page.screenshot({ path: `${output}/explore-day.png` });
      }
    }
    await startSampling('collapse');
    await file.getByRole('button', { name: 'clear day filter' }).click();
    await stopSampling(`${year}, clear day`, 1);
    check(
      (await file.locator('.archive-results').count()) === 0,
      `${year}: clearing the day removes the IOC section`,
    );
    check(
      Math.abs(
        (await file.evaluate((element) => element.getBoundingClientRect().height)) - compactHeight,
      ) < 0.5,
      `${year}: clearing restores the compact file height`,
    );
    await button.click({ position: { x: 120, y: 16 } });
    check(
      (await button.getAttribute('aria-expanded')) === 'false',
      `${year}: file body closes the year`,
    );
  }

  // Touch and reduced-motion users get the same full-file controls.
  await page.setViewportSize({ width: 820, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const firstFile = page.locator('.archive-folder').first();
  await firstFile.locator('.archive-file-toggle').focus();
  await page.keyboard.press('Enter');
  check(
    (await firstFile.locator('.archive-file-toggle').getAttribute('aria-expanded')) === 'true',
    'Keyboard opens the file at a narrow viewport',
  );
  check(
    await firstFile.locator('.archive-folder-drawer').isVisible(),
    'Reduced motion preserves the day heatmap',
  );
  check(
    (await firstFile.locator('.archive-results').count()) === 0,
    'Keyboard opening with reduced motion does not reserve IOC space',
  );
} catch (error) {
  report.failed.push(error.message);
} finally {
  await writeFile(`${output}/archive-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
