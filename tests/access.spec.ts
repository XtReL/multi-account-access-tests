import { test, expect } from '@playwright/test';
import { addProduct, bearer, createUser, signInContext } from './helpers';

// Target: OWASP Juice Shop, an intentionally vulnerable training app.
// Each test states the SECURE expectation. Where Juice Shop is known to break
// it on purpose, the test is marked test.fail(): the run stays green only while
// the known weakness is still reproduced, and turns red if behavior changes.

const APPLE = 1;  // Apple Juice (1000ml)
const ORANGE = 2; // Orange Juice (1000ml)

test('two users in isolated browser contexts each see only their own basket', async ({ browser, request, baseURL }) => {
  const a = await createUser(request, 'user-a');
  const b = await createUser(request, 'user-b');
  await addProduct(request, a, APPLE);
  await addProduct(request, b, ORANGE);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await signInContext(ctxA, a, baseURL!);
  await signInContext(ctxB, b, baseURL!);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto('/#/basket');
  await pageB.goto('/#/basket');

  await expect(pageA.getByText('Apple Juice (1000ml)')).toBeVisible();
  await expect(pageA.getByText('Orange Juice (1000ml)')).toHaveCount(0);
  await expect(pageB.getByText('Orange Juice (1000ml)')).toBeVisible();
  await expect(pageB.getByText('Apple Juice (1000ml)')).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});

test('user A cannot read user B basket by ID through the API', async ({ request }) => {
  test.fail(true, 'Juice Shop intentionally allows reading another user basket by ID (known training challenge)');
  const a = await createUser(request, 'user-a');
  const b = await createUser(request, 'user-b');
  await addProduct(request, b, ORANGE);

  const res = await request.get(`/rest/basket/${b.basketId}`, { headers: bearer(a) });
  const body = await res.json().catch(() => ({}));
  test.info().annotations.push({ type: 'observed', description: `status ${res.status()}, owner ${body?.data?.UserId}, requester ${a.userId}` });

  // Secure expectation: refused, or at least never another user's data.
  expect(res.status() === 200 && body?.data?.UserId === b.userId, 'A received B basket').toBe(false);
});

test('regular user cannot list all user accounts through the API', async ({ request }) => {
  test.fail(true, 'Juice Shop intentionally lets any signed-in user list all accounts (access check exists only in the UI)');
  const a = await createUser(request, 'user-a');
  await createUser(request, 'user-b');

  const res = await request.get('/api/Users', { headers: bearer(a) });
  const body = await res.json().catch(() => ({}));
  const count = Array.isArray(body?.data) ? body.data.length : 0;
  test.info().annotations.push({ type: 'observed', description: `status ${res.status()}, accounts returned ${count}` });

  // Secure expectation: refused for a non-admin role.
  expect([401, 403]).toContain(res.status());
});
