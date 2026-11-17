import { APIRequestContext, BrowserContext, expect } from '@playwright/test';

export type TestUser = { email: string; password: string; token: string; basketId: number; userId: number };

// Creates a fresh account through the public registration API and logs it in.
// Every run uses new random emails, so runs never depend on each other.
export async function createUser(api: APIRequestContext, label: string): Promise<TestUser> {
  const email = `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;
  const password = 'Test-Password-123';

  const reg = await api.post('/api/Users', {
    data: {
      email, password, passwordRepeat: password,
      securityQuestion: { id: 1 }, securityAnswer: 'test',
    },
  });
  expect(reg.status(), `registration of ${label}`).toBe(201);
  const userId = (await reg.json()).data.id as number;

  const login = await api.post('/rest/user/login', { data: { email, password } });
  expect(login.status(), `login of ${label}`).toBe(200);
  const auth = (await login.json()).authentication;

  return { email, password, token: auth.token, basketId: Number(auth.bid), userId };
}

export const bearer = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });

export async function addProduct(api: APIRequestContext, u: TestUser, productId: number) {
  const res = await api.post('/api/BasketItems', {
    headers: bearer(u),
    data: { ProductId: productId, BasketId: String(u.basketId), quantity: 1 },
  });
  expect(res.status(), `add product ${productId}`).toBe(200);
}

// Puts a logged-in session into a separate browser context, the same way the
// app stores it after a normal login, and hides the first-visit dialogs.
export async function signInContext(ctx: BrowserContext, u: TestUser, baseURL: string) {
  const { hostname } = new URL(baseURL);
  await ctx.addCookies([
    { name: 'token', value: u.token, domain: hostname, path: '/' },
    { name: 'cookieconsent_status', value: 'dismiss', domain: hostname, path: '/' },
    { name: 'welcomebanner_status', value: 'dismiss', domain: hostname, path: '/' },
  ]);
  await ctx.addInitScript(([token, bid]) => {
    window.localStorage.setItem('token', token);
    window.sessionStorage.setItem('bid', bid);
  }, [u.token, String(u.basketId)]);
}
