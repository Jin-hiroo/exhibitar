/**
 * Page-switch timing. Clicks through the Studio like a user and reports, per
 * step (median of the runs):
 * - readyMs: click → the next page's heading is on screen
 * - serverMs: that page's data request (RSC), from request start to last byte
 * - authMs: the session check in src/proxy.ts (its Server-Timing header)
 * - region: where the request ran, "edge → function" (x-vercel-id on Vercel)
 *
 * Usage: node scripts/perf-nav.mjs [base URL] [runs]
 *   With PERF_EMAIL and PERF_PASSWORD it signs in first and also opens your
 *   newest exhibit and the Account page.
 */
import { chromium } from '@playwright/test';

const [base = 'http://localhost:3000', runs = '3'] = process.argv.slice(2);
const { PERF_EMAIL: email, PERF_PASSWORD: password } = process.env;

/** [step, link to click ('card' = the newest exhibit), heading of the next page] */
const anonymousSteps = [
  ['home → studio', 'Open the Studio', 'Studio'],
  ['studio → new exhibit', '+ New exhibit', 'Untitled exhibit'],
  ['new exhibit → studio', '‹ Studio', 'Studio'],
];
const signedInSteps = [
  ['home → studio', 'Open the Studio', 'Studio'],
  ['studio → exhibit', 'card', null],
  ['exhibit → studio', '‹ Studio', 'Studio'],
  ['studio → account', 'Account', 'Account'],
  ['account → studio', '← Studio', 'Studio'],
  ['studio → new exhibit', '+ New exhibit', 'Untitled exhibit'],
];

const browser = await chromium.launch();
const rows = [];
for (let run = 0; run < Number(runs); run++) {
  const ctx = await browser.newContext({ baseURL: base });
  const page = await ctx.newPage();
  // page data requests (not prefetches) that finished during the current step
  let rsc = [];
  page.on('requestfinished', async (req) => {
    const h = req.headers();
    if (!req.url().includes('_rsc=')) return;
    if (h['next-router-prefetch'] || h['next-router-segment-prefetch']) return;
    const res = await req.response();
    rsc.push({
      ms: req.timing().responseEnd,
      timing: (await res?.headerValue('server-timing')) ?? '',
      vercelId: (await res?.headerValue('x-vercel-id')) ?? '',
    });
  });

  if (email && password) {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/\/studio/);
  }
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  for (const [step, link, heading] of email ? signedInSteps : anonymousSteps) {
    const target =
      link === 'card'
        ? page.locator('main a[href^="/studio/"]:has(strong)').first()
        : page.getByRole('link', { name: link, exact: true });
    const title = link === 'card' ? await target.locator('strong').textContent() : heading;
    rsc = [];
    // timed inside the page, from the click event to the new heading (checked every frame)
    await page.evaluate(() =>
      addEventListener('click', () => (window.__perfClick = performance.now()), {
        capture: true,
        once: true,
      }),
    );
    await target.click();
    const ready = await page.waitForFunction(
      (h) =>
        document.querySelector('h1')?.textContent === h && performance.now() - window.__perfClick,
      title,
      { polling: 'raf', timeout: 30_000 },
    );
    const readyMs = await ready.jsonValue();
    await page.waitForLoadState('networkidle');
    const data = rsc.at(-1);
    rows.push({
      step,
      readyMs,
      serverMs: data?.ms,
      authMs: Number(data?.timing.match(/auth;dur=([\d.]+)/)?.[1]),
      region: data && (data.vercelId.split('::').slice(0, -1).join(' → ') || 'local'),
    });
  }
  await ctx.close();
}
await browser.close();

const median = (xs) => {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? Math.round(v[Math.floor(v.length / 2)]) : '–';
};
console.log(`${base} · ${runs} runs · ${email ? 'signed in' : 'anonymous'}`);
console.table(
  [...new Set(rows.map((r) => r.step))].map((step) => {
    const rs = rows.filter((r) => r.step === step);
    return {
      step,
      readyMs: median(rs.map((r) => r.readyMs)),
      serverMs: median(rs.map((r) => r.serverMs)),
      authMs: median(rs.map((r) => r.authMs)),
      region: rs.find((r) => r.region)?.region ?? '–',
    };
  }),
);
