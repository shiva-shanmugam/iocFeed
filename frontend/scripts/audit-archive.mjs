import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'artifacts/functionality';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { passed: [], failed: [], samples: 0 };
const check = (condition, message) => (condition ? report.passed : report.failed).push(message);

// Observe every animation frame, including the loading state between a click and its results.
async function startSampling() {
  await page.evaluate(() => {
    const positions = () =>
      [...document.querySelectorAll('.archive-folder')].map((file) => {
        const rect = file.getBoundingClientRect();
        return { year: file.dataset.year, y: rect.y + globalThis.scrollY, height: rect.height };
      });
    const baseline = positions();
    const audit = { running: true, frames: 0, errors: [] };
    globalThis.archiveMotionAudit = audit;
    const sample = () => {
      if (!audit.running) return;
      audit.frames++;
      positions().forEach((file, index) => {
        if (
          Math.abs(file.y - baseline[index].y) > 0.5 ||
          Math.abs(file.height - baseline[index].height) > 0.5
        ) {
          audit.errors.push(`File ${file.year} moved while selecting a day`);
        }
      });
      for (const cell of document.querySelectorAll('.archive-year-grid button')) {
        const rect = cell.getBoundingClientRect();
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
  });
}

async function stopSampling(label) {
  await page.waitForTimeout(350);
  const result = await page.evaluate(() => {
    globalThis.archiveMotionAudit.running = false;
    return globalThis.archiveMotionAudit;
  });
  report.samples += result.frames;
  check(
    result.errors.length === 0,
    `${label}: files and day click targets stayed steady (${result.frames} frames)`,
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
    const cells = file.locator('.archive-year-grid button:not([aria-label$=": 0 indicators"])');
    for (const day of [0, 1, 2]) {
      await startSampling();
      await cells.nth(day).click();
      await file.locator('.archive-result').first().waitFor();
      await stopSampling(`${year}, day ${day + 1}`);
    }
    await startSampling();
    await file.getByRole('button', { name: 'clear day filter' }).click();
    await stopSampling(`${year}, clear day`);
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
} catch (error) {
  report.failed.push(error.message);
} finally {
  await writeFile(`${output}/archive-report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;
