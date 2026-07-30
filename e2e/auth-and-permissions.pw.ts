import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const ownerEmail = process.env.ADMIN_EMAIL || 'owner@example.com';
const ownerPassword = process.env.ADMIN_PASSWORD || 'OwnerPassword123!';
const viewerEmail = 'viewer@example.com';
const viewerPassword = 'ViewerPassword123!';

async function login(page: Page, email: string, password: string) {
  await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await Promise.all([
    page.waitForURL(/\/en\/dashboard/, { timeout: 60_000 }),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}

async function openProperties(page: Page, role: 'owner' | 'viewer') {
  await page.goto('/en/properties', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-pm-role', role, { timeout: 60_000 });

  const controls = page.locator('[data-pm-write-resource="properties"]');
  await expect.poll(() => controls.count(), {
    message: `Expected the Properties mutation controls to render for the ${role} session`,
    timeout: 60_000,
  }).toBeGreaterThan(0);

  return controls;
}

async function ensureViewer(context: BrowserContext) {
  const createResponse = await context.request.post('/api/settings/users', {
    data: {
      name: 'Read Only User',
      email: viewerEmail,
      password: viewerPassword,
      role: 'viewer',
    },
  });

  if (createResponse.status() === 201) return;
  expect(createResponse.status()).toBe(409);

  const membersResponse = await context.request.get('/api/settings/users');
  expect(membersResponse.status()).toBe(200);
  const members = (await membersResponse.json()).members as Array<{
    id: string;
    user: { email: string };
  }>;
  const existing = members.find((membership) => membership.user.email === viewerEmail);
  expect(existing, 'Existing viewer membership was not returned by the users API').toBeTruthy();

  const updateResponse = await context.request.patch('/api/settings/users', {
    data: {
      membershipId: existing!.id,
      role: 'viewer',
      isActive: true,
      password: viewerPassword,
    },
  });
  expect(updateResponse.status()).toBe(200);
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
  test.setTimeout(120_000);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, ownerEmail, ownerPassword);

  const ownerSession = await ownerContext.request.get('/api/auth/session');
  expect(ownerSession.status()).toBe(200);
  expect((await ownerSession.json()).session.role).toBe('owner');

  const ownerControls = await openProperties(ownerPage, 'owner');
  await expect(ownerControls.first()).toBeVisible({ timeout: 60_000 });

  await ensureViewer(ownerContext);
  await ownerContext.close();

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await login(viewerPage, viewerEmail, viewerPassword);

  const viewerControls = await openProperties(viewerPage, 'viewer');
  await expect(viewerControls.first()).toBeHidden({ timeout: 60_000 });

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
