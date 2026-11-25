import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const measureHorizontalOverflow = (page: Page) => page.evaluate(() => {
  const viewport = document.documentElement.clientWidth;
  const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        className: element.getAttribute('class'),
        right: Math.round(bounds.right),
        width: Math.round(bounds.width),
      };
    })
    .filter((element) => element.right > viewport + 1)
    .sort((left, right) => right.right - left.right)
    .slice(0, 10);
  return {
    viewport,
    content: document.documentElement.scrollWidth,
    offenders,
  };
});

test('public browse filters items through the API', async ({ page }) => {
  await page.goto('/items');
  await expect(page.getByRole('heading', { name: 'Around your campus' })).toBeVisible();

  const foundFilter = page.getByRole('button', { name: 'Found', exact: true });
  const foundItemsResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/items') && url.searchParams.get('type') === 'Found';
  });
  await foundFilter.click();
  await expect(foundFilter).toHaveAttribute('aria-pressed', 'true');
  expect((await foundItemsResponse).ok()).toBe(true);
});

test('public pages fit a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/', '/items', '/threads', '/safety-help', '/login']) {
    await page.goto(route);
    await expect(page.locator('main')).toBeVisible();

    const dimensions = await measureHorizontalOverflow(page);
    expect(
      dimensions.content,
      `${route} should not overflow horizontally: ${JSON.stringify(dimensions.offenders)}`,
    ).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test('unauthenticated visitors are redirected from the admin vault', async ({ page }) => {
  await page.goto('/admin-dashboard/vault');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('invalid login displays an accessible error', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill('invalid-e2e@qcu.test');
  await page.getByRole('textbox', { name: 'Password' }).fill('invalid-e2e-password');

  const loginResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '→ Log in' }).click();
  expect((await loginResponse).status()).toBe(401);
  await expect(page.getByRole('alert')).toBeVisible();
});

test('seeded administrator can open the vault and load its data', async ({ page }) => {
  if (!adminEmail || !adminPassword) {
    test.skip(true, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.');
    return;
  }

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill(adminEmail);
  await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword);
  await page.getByRole('button', { name: '→ Log in' }).click();
  await expect(page).toHaveURL(/\/items$/);

  await page.setViewportSize({ width: 390, height: 844 });
  const vaultResponse = page.waitForResponse((response) =>
    response.url().includes('/api/vault?status=ALL') && response.request().method() === 'GET');
  const eligibleItemsResponse = page.waitForResponse((response) =>
    response.url().includes('/api/admin/items?status=APPROVED') && response.request().method() === 'GET');
  await page.goto('/admin-dashboard/vault');

  await expect(page.getByRole('heading', { name: 'Vault & physical handover' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vault counts' })).toBeVisible();
  const dimensions = await measureHorizontalOverflow(page);
  expect(
    dimensions.content,
    `the admin vault should not overflow horizontally: ${JSON.stringify(dimensions.offenders)}`,
  ).toBeLessThanOrEqual(dimensions.viewport);
  expect((await vaultResponse).status()).toBe(200);
  expect((await eligibleItemsResponse).status()).toBe(200);
});
