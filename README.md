# multi-account-access-tests

Playwright (TypeScript) checks of how two accounts interact, run against
[OWASP Juice Shop](https://github.com/juice-shop/juice-shop), an intentionally
vulnerable training application. The weaknesses shown here are known and
built into Juice Shop on purpose. They are not new findings.

## What each test proves

| Test | What it proves |
|---|---|
| Two users in isolated browser contexts | Each signed-in user sees only their own basket in the UI when both sessions are open at once. |
| User A reads user B basket by ID | The basket API returns another user's basket when called with that user's ID (known weakness). |
| Regular user lists all accounts | The accounts API answers a non-admin user, the restriction exists only in the UI (known weakness). |

Test 1 checks isolation that works. Tests 2 and 3 pass only when the other
user's data is actually returned, so a failure for any other reason, such as
broken registration, makes the run red instead of hiding behind an expected
failure.

Fresh accounts with random emails are created on every run, so runs do not
depend on each other or on seeded data.

## Evidence

Each run in GitHub Actions uploads the Playwright HTML report with traces,
screenshots and the observed status codes as the `playwright-report` artifact.

## Run locally

```
docker run -d -p 3000:3000 bkimminich/juice-shop:v17.1.1
npm install
npx playwright install chromium
npx playwright test
```

## How this was made

The tests and CI setup were written with an AI assistant (Claude). I set the
scope and the checks in advance, and reviewed the results against the run
evidence.
