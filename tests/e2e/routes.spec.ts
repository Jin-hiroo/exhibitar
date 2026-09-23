import { expect, test } from '@playwright/test';

const routes: [path: string, heading: RegExp][] = [
  ['/', /ExhibitAR/],
  ['/login', /Sign in/],
  ['/studio', /Studio/],

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

test('studio: sample STL → mat → annotate → preview, without an account', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/studio/new');
  await page.getByRole('button', { name: '60 mm cube' }).click();
  await expect(page.getByText('60 × 60 × 60 mm')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: /Generate model & mat/ }).click();
  // lands on the Mat tab with downloads
  await expect(page.getByRole('link', { name: 'Download PDF' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByAltText('Placement mat')).toBeVisible();
  await page.getByRole('tab', { name: '3 · Annotate' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('tab', { name: '4 · Preview' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('tab', { name: '5 · Publish' }).click();
  await expect(page.getByText('Publishing needs an account')).toBeVisible();
});

test('studio list and login render', async ({ page }) => {
  await page.goto('/studio');
  await expect(page.getByRole('link', { name: '+ New exhibit' })).toBeVisible();
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
});

test('editing a saved exhibit requires signing in', async ({ page }) => {
  await page.goto('/studio/abc123def0');
  await expect(page).toHaveURL(
    /\/login\?next=%2Fstudio%2Fabc123def0|\/login\?next=\/studio\/abc123def0/,
  );
});
