/**
 * Viewer load budget check (CLAUDE.md: interactive < 3 s on 4G).
 * Lighthouse "slow 4G" mobile profile: 150 ms RTT, 1.6 Mbps down, 4x CPU slowdown.
 * Usage: node scripts/perf-viewer.mjs <viewer URL> [runs]
 */
import { chromium } from '@playwright/test';

const [url = 'http://localhost:3000/v/mockcube01', runs = '3'] = process.argv.slice(2);
const results = [];
const browser = await chromium.launch();
for (let i = 0; i < Number(runs); i++) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1.6e6 / 8,
    uploadThroughput: 750e3 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1 }).waitFor();
  const card = Date.now() - t0;
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        x.textContent?.includes('View in 3D'),
      );
      return !!b && !b.disabled;
    },
    null,
    { timeout: 60_000 },
  );
  results.push({ landingCardMs: card, exhibitReadyMs: Date.now() - t0 });
  await ctx.close();
}
await browser.close();
const med = (k) => results.map((r) => r[k]).sort((a, b) => a - b)[Math.floor(results.length / 2)];
console.log(
  JSON.stringify({
    runs: results,
    median: { landingCardMs: med('landingCardMs'), exhibitReadyMs: med('exhibitReadyMs') },
  }),
);
