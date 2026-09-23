import { expect, test } from '@playwright/test';

const routes: [path: string, heading: RegExp][] = [
  ['/', /ExhibitAR/],
  ['/login', /Sign in/],
  ['/studio', /Studio/],
  ['/studio/new', /New exhibit/],
  ['/studio/abc123', /Exhibit abc123/],
  ['/studio/abc123/calibrate', /Calibrate abc123/],
  ['/v/mockcube01', /Mock cube/],
];

for (const [path, heading] of routes) {
  test(`renders ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  });
}

test('unknown exhibits are 404', async ({ page }) => {
  const res = await page.goto('/v/does-not-exist');
  expect(res?.status()).toBe(404);
});

test('viewer falls back to a 3D view with labels and details when AR is unavailable', async ({
  page,
}) => {
  await page.goto('/v/mockcube01');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mock cube');
  const view3d = page.getByRole('button', { name: 'View in 3D' });
  await expect(view3d).toBeEnabled({ timeout: 15_000 });
  await view3d.click();
  await expect(page.locator('canvas')).toBeVisible();
  // guided tour → first annotation's detail sheet
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Top face');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
});
