import { expect, test, type Page } from '@playwright/test';

const ownerEmail = process.env.ADMIN_EMAIL || 'owner@example.com';
const ownerPassword = process.env.ADMIN_PASSWORD || 'OwnerPassword123!';
const viewerEmail = 'viewer@example.com';
const viewerPassword = 'ViewerPassword123!';

async function login(page: Page, email: string, password: string) {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard/),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}

test('unauthenticated routes redirect to the localized login page', async ({ page }) => {
  await page.goto('/en/dashboard');
  await expect(page).toHaveURL(/\/en\/login\?next=(%2F|\/)dashboard/);
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('Arabic login keeps the document in RTL mode', async ({ page }) => {
  await page.goto('/ar/login');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('bootstrap owner can work while a viewer stays read-only', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, ownerEmail, ownerPassword);

  const ownerSession = await ownerContext.request.get('/api/auth/session');
  expect(ownerSession.status()).toBe(200);
  expect((await ownerSession.json()).session.role).toBe('owner');

  await ownerPage.goto('/en/properties');
  const ownerControls = ownerPage.locator('[data-pm-write-resource="properties"]');
  expect(await ownerControls.count()).toBeGreaterThan(0);
  await expect(ownerControls.first()).toBeVisible();

  const createViewer = await ownerContext.request.post('/api/settings/users', {
    data: {
      name: 'Read Only User',
      email: viewerEmail,
      password: viewerPassword,
      role: 'viewer',
    },
  });
  expect(createViewer.status()).toBe(201);
  await ownerContext.close();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, viewerEmail, viewerPassword);
  await viewerPage.goto('/en/properties');

  const viewerControls = viewerPage.locator('[data-pm-write-resource="properties"]');
  expect(await viewerControls.count()).toBeGreaterThan(0);
  await expect(viewerControls.first()).toBeHidden();

  const deniedMutation = await viewerContext.request.post('/api/properties', {
    data: {
      name: 'Denied Property',
      address: '1 Test Street',
      city: 'Test City',
      type: 'residential',
    },
  });
  expect(deniedMutation.status()).toBe(403);
  await viewerContext.close();
});
