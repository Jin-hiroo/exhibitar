import { expect, test } from '@playwright/test';

const routes: [path: string, heading: RegExp][] = [
  ['/', /ExhibitAR/],
  ['/login', /Sign in/],
  ['/studio', /Studio/],
  ['/studio/new', /New exhibit/],
  ['/studio/abc123', /Exhibit abc123/],
  ['/studio/abc123/calibrate', /Calibrate abc123/],
  ['/v/abc123', /Exhibit abc123/],
];

for (const [path, heading] of routes) {
  test(`renders ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  });
}
