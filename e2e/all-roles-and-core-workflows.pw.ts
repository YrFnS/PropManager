import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
  type Response,
} from '@playwright/test';

type AppRole = 'owner' | 'manager' | 'accountant' | 'maintenance' | 'viewer';
type WriteResource =
  | 'properties'
  | 'units'
  | 'tenants'
  | 'leases'
  | 'payments'
  | 'maintenance'
  | 'messages';

interface Account {
  email: string;
  password: string;
  name: string;
  role: AppRole;
}

interface Fixture {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitNumber: string;
  tenantId: string;
  tenantName: string;
  leaseId: string;
  maintenanceTitle: string;
  messageSubject: string;
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const ownerAccount: Account = {
  email: process.env.ADMIN_EMAIL || 'owner@example.com',
  password: process.env.ADMIN_PASSWORD || 'OwnerPassword123',
  name: process.env.ADMIN_NAME || 'Owner',
  role: 'owner',
};

const roleAccounts: Record<Exclude<AppRole, 'owner'>, Account> = {
  manager: {
    email: 'e2e.manager@propmanager.test',
    password: 'ManagerPassword123!',
    name: 'E2E Manager',
    role: 'manager',
  },
  accountant: {
    email: 'e2e.accountant@propmanager.test',
    password: 'AccountantPassword123!',
    name: 'E2E Accountant',
    role: 'accountant',
  },
  maintenance: {
    email: 'e2e.maintenance@propmanager.test',
    password: 'MaintenancePassword123!',
    name: 'E2E Maintenance',
    role: 'maintenance',
  },
  viewer: {
    email: 'e2e.viewer@propmanager.test',
    password: 'ViewerPassword123!',
    name: 'E2E Viewer',
    role: 'viewer',
  },
};

const inactiveAccount: Account = {
  email: 'e2e.inactive@propmanager.test',
  password: 'InactivePassword123!',
  name: 'E2E Inactive',
  role: 'viewer',
};

const sections = [
  'dashboard',
  'properties',
  'units',
  'tenants',
  'leases',
  'payments',
  'maintenance',
  'messages',
  'reports',
  'settings',
] as const;

const attributedControlResources = [
  'properties',
  'units',
  'tenants',
  'leases',
  'maintenance',
  'messages',
] as const satisfies readonly WriteResource[];

const writeEndpoints: ReadonlyArray<{ resource: WriteResource; url: string }> = [
  { resource: 'properties', url: '/api/properties' },
  { resource: 'units', url: '/api/units' },
  { resource: 'tenants', url: '/api/tenants' },
  { resource: 'leases', url: '/api/leases' },
  { resource: 'payments', url: '/api/payments' },
  { resource: 'maintenance', url: '/api/maintenance' },
  { resource: 'messages', url: '/api/messages' },
];

const roleWrites: Record<AppRole, readonly WriteResource[]> = {
  owner: ['properties', 'units', 'tenants', 'leases', 'payments', 'maintenance', 'messages'],
  manager: ['properties', 'units', 'tenants', 'leases', 'payments', 'maintenance', 'messages'],
  accountant: ['payments'],
  maintenance: ['maintenance'],
  viewer: [],
};

function contextIp(index: number) {
  return `198.51.100.${20 + index}`;
}

async function newRoleContext(browser: Browser, index: number) {
  return browser.newContext({
    baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': contextIp(index) },
  });
}

async function login(page: Page, account: Account) {
  await page.goto('/en/login');
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);

  const loginResponsePromise = page.waitForResponse(
    (response: Response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status(), `${account.role} login response`).toBe(200);
  await expect(page).toHaveURL(/\/en\/dashboard$/);
  await expect(page.locator('html')).toHaveAttribute('data-pm-role', account.role);
}

async function ensureMember(request: APIRequestContext, account: Account) {
  const createResponse = await request.post('/api/settings/users', {
    data: {
      email: account.email,
      name: account.name,
      password: account.password,
      role: account.role,
    },
  });

  if (createResponse.status() === 201) {
    const payload = (await createResponse.json()) as { member: { id: string } };
    return payload.member.id;
  }

  expect(createResponse.status(), `create ${account.role} member`).toBe(409);
  const listResponse = await request.get('/api/settings/users');
  expect(listResponse.status()).toBe(200);
  const payload = (await listResponse.json()) as {
    members: Array<{ id: string; user: { email: string } }>;
  };
  const member = payload.members.find((item) => item.user.email === account.email);
  expect(member, `existing member ${account.email}`).toBeTruthy();

  const updateResponse = await request.patch('/api/settings/users', {
    data: {
      membershipId: member!.id,
      name: account.name,
      password: account.password,
      role: account.role,
      isActive: true,
    },
  });
  expect(updateResponse.status(), `refresh ${account.role} member`).toBe(200);
  return member!.id;
}

async function createJson<T>(request: APIRequestContext, url: string, data: unknown) {
  const response = await request.post(url, { data });
  expect(response.status(), `POST ${url}`).toBe(201);
  return (await response.json()) as T;
}

async function assertRoleSession(context: BrowserContext, role: AppRole) {
  const response = await context.request.get('/api/auth/session');
  expect(response.status(), `${role} session endpoint`).toBe(200);
  const payload = (await response.json()) as { session: { role: AppRole } };
  expect(payload.session.role).toBe(role);
}

async function assertPageSmoke(page: Page, role: AppRole) {
  const serverErrors: string[] = [];
  const recordServerError = (response: Response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  };
  page.on('response', recordServerError);

  try {
    for (const section of sections) {
      const navigation = await page.goto(`/en/${section}`, { waitUntil: 'domcontentloaded' });
      expect(navigation?.status(), `${role} /${section}`).toBeLessThan(400);
      await expect(page.locator('html')).toHaveAttribute('data-pm-role', role);
      await expect(page.locator('h1').first(), `${role} /${section} heading`).toBeVisible();
      await expect(page.locator('body')).not.toContainText(
        'Application error: a client-side exception has occurred',
      );
      await page.waitForTimeout(150);
    }
  } finally {
    page.off('response', recordServerError);
  }

  expect(serverErrors, `${role} received no same-origin 5xx responses`).toEqual([]);
}

async function assertUiPermissions(page: Page, role: AppRole) {
  for (const resource of attributedControlResources) {
    await page.goto(`/en/${resource}`, { waitUntil: 'domcontentloaded' });
    const controls = page.locator(`[data-pm-write-resource="${resource}"]`);
    await expect
      .poll(() => controls.count(), { message: `${resource} exposes tagged write controls` })
      .toBeGreaterThan(0);

    if (roleWrites[role].includes(resource)) {
      await expect(controls.first(), `${role} can write ${resource}`).toBeVisible();
    } else {
      await expect(controls.first(), `${role} cannot write ${resource}`).toBeHidden();
    }
  }

  await page.goto('/en/payments', { waitUntil: 'domcontentloaded' });
  const recordPayment = page.getByRole('button', { name: /record payment/i });
  if (roleWrites[role].includes('payments')) {
    await expect(recordPayment, `${role} payment write control`).toBeVisible();
  } else {
    await expect(recordPayment, `${role} payment write control`).toHaveCount(0);
  }
}

async function assertApiPermissions(context: BrowserContext, role: AppRole) {
  for (const endpoint of writeEndpoints) {
    const response = await context.request.post(endpoint.url, { data: {} });
    const expectedStatus = roleWrites[role].includes(endpoint.resource) ? 400 : 403;
    expect(
      response.status(),
      `${role} ${endpoint.resource} write boundary: ${await response.text()}`,
    ).toBe(expectedStatus);
  }

  const usersResponse = await context.request.post('/api/settings/users', { data: {} });
  expect(usersResponse.status(), `${role} user administration`).toBe(role === 'owner' ? 400 : 403);

  const organizationResponse = await context.request.patch('/api/settings/organization', {
    data: {},
  });
  expect(organizationResponse.status(), `${role} organization administration`).toBe(
    role === 'owner' ? 400 : 403,
  );
}

async function createCoreFixture(page: Page, context: BrowserContext, runId: string): Promise<Fixture> {
  const propertyName = `E2E Property ${runId}`;
  await page.goto('/en/properties');
  await page.getByRole('button', { name: 'Add Property' }).first().click();
  await page.getByLabel('Property Name', { exact: true }).fill(propertyName);
  await page.getByLabel('Address', { exact: true }).fill('100 E2E Avenue');
  await page.getByLabel('City', { exact: true }).fill('Baghdad');

  const propertyResponsePromise = page.waitForResponse(
    (response: Response) =>
      response.url().endsWith('/api/properties') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save' }).click();
  const propertyResponse = await propertyResponsePromise;
  expect(propertyResponse.status(), 'property created through the browser').toBe(201);
  const property = (await propertyResponse.json()) as { id: string };
  await expect(page.getByText(propertyName).first()).toBeVisible();

  const unitNumber = `E2E-${runId}`;
  const unit = await createJson<{ id: string }>(context.request, '/api/units', {
    propertyId: property.id,
    unitNumber,
    floor: 1,
    rooms: 2,
    bathrooms: 1,
    area: 82,
    rentAmount: 1250,
    status: 'available',
  });

  const tenantName = `E2E Tenant ${runId}`;
  const tenant = await createJson<{ id: string }>(context.request, '/api/tenants', {
    name: tenantName,
    email: `tenant.${runId}@propmanager.test`,
    phone: '+9647700000000',
    status: 'active',
  });

  const lease = await createJson<{ id: string }>(context.request, '/api/leases', {
    unitId: unit.id,
    tenantId: tenant.id,
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    rentAmount: 1250,
    deposit: 2500,
    status: 'active',
  });

  await createJson(context.request, '/api/payments', {
    leaseId: lease.id,
    amount: 1250,
    dueDate: '2026-08-05',
    paidDate: '2026-08-05',
    status: 'paid',
    method: 'cash',
    reference: `OWNER-${runId}`,
  });

  const maintenanceTitle = `E2E plumbing ${runId}`;
  await createJson(context.request, '/api/maintenance', {
    propertyId: property.id,
    unitId: unit.id,
    tenantId: tenant.id,
    title: maintenanceTitle,
    description: 'Browser-generated maintenance fixture',
    priority: 'urgent',
    status: 'open',
    category: 'plumbing',
  });

  const messageSubject = `E2E message ${runId}`;
  await createJson(context.request, '/api/messages', {
    senderName: tenantName,
    senderEmail: `tenant.${runId}@propmanager.test`,
    subject: messageSubject,
    content: 'Browser-generated message fixture',
    category: 'general',
  });

  return {
    propertyId: property.id,
    propertyName,
    unitId: unit.id,
    unitNumber,
    tenantId: tenant.id,
    tenantName,
    leaseId: lease.id,
    maintenanceTitle,
    messageSubject,
  };
}

async function assertFixtureInBrowser(page: Page, fixture: Fixture) {
  const expectations: ReadonlyArray<{ section: string; text: string }> = [
    { section: 'properties', text: fixture.propertyName },
    { section: 'units', text: fixture.unitNumber },
    { section: 'tenants', text: fixture.tenantName },
    { section: 'leases', text: fixture.tenantName },
    { section: 'payments', text: fixture.tenantName },
    { section: 'maintenance', text: fixture.maintenanceTitle },
    { section: 'messages', text: fixture.messageSubject },
  ];

  for (const expectation of expectations) {
    await page.goto(`/en/${expectation.section}`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(expectation.text).first(),
      `${expectation.section} renders its core fixture`,
    ).toBeVisible();
  }
}

test('all roles can complete their allowed workflows and are blocked everywhere else', async ({
  browser,
}: { browser: Browser }) => {
  test.setTimeout(600_000);
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const ownerContext = await newRoleContext(browser, 1);
  const ownerPage = await ownerContext.newPage();
  await login(ownerPage, ownerAccount);

  for (const account of Object.values(roleAccounts)) {
    await ensureMember(ownerContext.request, account);
  }
  const inactiveMembershipId = await ensureMember(ownerContext.request, inactiveAccount);
  const deactivateResponse = await ownerContext.request.patch('/api/settings/users', {
    data: { membershipId: inactiveMembershipId, isActive: false },
  });
  expect(deactivateResponse.status(), 'deactivate test membership').toBe(200);

  const fixture = await createCoreFixture(ownerPage, ownerContext, runId);
  await assertFixtureInBrowser(ownerPage, fixture);

  const accounts: Account[] = [ownerAccount, ...Object.values(roleAccounts)];
  for (let index = 0; index < accounts.length; index += 1) {
    const account = accounts[index];
    const isOwner = account.role === 'owner';
    const context = isOwner ? ownerContext : await newRoleContext(browser, index + 2);
    const page = isOwner ? ownerPage : await context.newPage();

    if (!isOwner) await login(page, account);
    await assertRoleSession(context, account.role);
    await assertPageSmoke(page, account.role);
    await assertUiPermissions(page, account.role);
    await assertApiPermissions(context, account.role);

    if (account.role === 'manager') {
      const subject = `Manager message ${runId}`;
      await createJson(context.request, '/api/messages', {
        senderName: account.name,
        senderEmail: account.email,
        subject,
        content: 'Manager-authorized message',
        category: 'general',
      });
      await page.goto('/en/messages');
      await expect(page.getByText(subject).first()).toBeVisible();
    }

    if (account.role === 'accountant') {
      await createJson(context.request, '/api/payments', {
        leaseId: fixture.leaseId,
        amount: 25,
        dueDate: '2026-09-05',
        status: 'pending',
        reference: `ACCOUNTANT-${runId}`,
      });
      const paymentsResponse = await context.request.get('/api/payments?limit=100');
      expect(paymentsResponse.status()).toBe(200);
      const payments = (await paymentsResponse.json()) as {
        data: Array<{ reference: string | null }>;
      };
      expect(payments.data.some((payment) => payment.reference === `ACCOUNTANT-${runId}`)).toBe(
        true,
      );
    }

    if (account.role === 'maintenance') {
      const title = `Maintenance staff request ${runId}`;
      await createJson(context.request, '/api/maintenance', {
        propertyId: fixture.propertyId,
        unitId: fixture.unitId,
        tenantId: fixture.tenantId,
        title,
        description: 'Maintenance-role authorized request',
        priority: 'high',
        status: 'open',
        category: 'electrical',
      });
      await page.goto('/en/maintenance');
      await expect(page.getByText(title).first()).toBeVisible();
    }

    if (!isOwner) await context.close();
  }

  const inactiveContext = await newRoleContext(browser, 10);
  const inactivePage = await inactiveContext.newPage();
  await inactivePage.goto('/en/login');
  await expect(inactivePage.locator('form[data-hydrated="true"]')).toBeVisible();
  await inactivePage.getByLabel('Email').fill(inactiveAccount.email);
  await inactivePage.getByLabel('Password').fill(inactiveAccount.password);
  const inactiveResponsePromise = inactivePage.waitForResponse(
    (response: Response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  );
  await inactivePage.getByRole('button', { name: 'Sign in' }).click();
  const inactiveResponse = await inactiveResponsePromise;
  expect(inactiveResponse.status(), 'inactive membership cannot sign in').toBe(403);
  await expect(inactivePage).toHaveURL(/\/en\/login$/);

  await inactiveContext.close();
  await ownerContext.close();
});
