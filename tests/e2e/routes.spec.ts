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
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username');
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /passkey/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'new-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('button', { name: /Forgot password/ })).toHaveCount(0);
});

test('account settings require signing in', async ({ page }) => {
  await page.goto('/studio/account');
  await expect(page).toHaveURL(/\/login\?next=%2Fstudio%2Faccount|\/login\?next=\/studio\/account/);
});

test('editing a saved exhibit requires signing in', async ({ page }) => {
  await page.goto('/studio/abc123def0');
  await expect(page).toHaveURL(
    /\/login\?next=%2Fstudio%2Fabc123def0|\/login\?next=\/studio\/abc123def0/,
  );
});

test('a failed Google sign-in returns to the login page with a fixed message', async ({ page }) => {
  // cancelled on Google's consent screen: Supabase redirects back with ?error=access_denied
  await page.goto('/auth/callback?error=access_denied&next=%2Fstudio%2Faccount');
  await expect(page).toHaveURL(/\/login\?error=access_denied&next=%2Fstudio%2Faccount$/);
  await expect(page.getByText('Google sign-in was cancelled.')).toBeVisible();

  // text in the URL is never shown
  await page.goto('/login?error=Call%20support%20at%20%2B1%20555%200100');
  await expect(page.getByText('Google sign-in did not finish. Try again.')).toBeVisible();
  await expect(page.getByText(/555 0100/)).toHaveCount(0);
});

test.describe('on iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('Start AR opens the exhibit in the Needle Go App Clip', async ({ page }) => {
    await page.goto('/v/mockcube01');
    const start = page.getByRole('link', { name: 'Start AR' });
    await expect(start).toBeVisible({ timeout: 15_000 });
    const href = await start.getAttribute('href');
    expect(href).toMatch(/^https:\/\/appclip\.needle\.tools\/ar\?url=/);
    expect(decodeURIComponent(href!.split('url=')[1]!)).toMatch(/\/v\/mockcube01$/);
  });
});
