# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Dashboard to Chat navigation and unmounting
- Location: tests\navigation.spec.ts:4:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByText('chat', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e5]: System Boot v1.0.4
    - paragraph [ref=e6]: "> INITIALIZING SECURE HANDSHAKE..."
    - paragraph [ref=e7]: "> DECRYPTING SANCTUARY PROTOCOLS..."
    - paragraph [ref=e8]: "> MOUNTING ENCRYPTED VOLUMES..."
    - paragraph [ref=e9]: "> VERIFYING IDENTITY TOKEN..."
    - paragraph [ref=e10]: "> ESTABLISHING REAL-TIME SYNC..."
    - paragraph [ref=e11]: "> ENTERING ATTIC.EXE_"
  - generic [ref=e20]: Sanctuary Link Active
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAsTestUser } from './utils';
  3  | 
  4  | test('Dashboard to Chat navigation and unmounting', async ({ page }) => {
  5  |   // 1. Login
  6  |   await loginAsTestUser(page, 'test@example.com');
  7  |   
  8  |   // 2. Open Chat
> 9  |   await page.getByText('chat', { exact: true }).click();
     |                                                 ^ Error: locator.click: Test timeout of 30000ms exceeded.
  10 |   await expect(page.getByText('chat_room.exe')).toBeVisible();
  11 |   
  12 |   // 3. Close Chat using the aria-label
  13 |   await page.getByLabel('Close').first().click();
  14 |   
  15 |   // 4. Verify unmounted (not just hidden)
  16 |   await expect(page.getByText('chat_room.exe')).not.toBeAttached();
  17 | });
  18 | 
  19 | test('Activities Hub to Pictionary and back', async ({ page }) => {
  20 |   await loginAsTestUser(page, 'test@example.com');
  21 |   
  22 |   // Open Games
  23 |   await page.getByText('games', { exact: true }).click();
  24 |   await expect(page.getByText('activities_hub.exe')).toBeVisible();
  25 |   
  26 |   // Select Pictionary
  27 |   await page.getByText('Pictionary', { exact: true }).click();
  28 |   
  29 |   // Handle Setup Window
  30 |   await expect(page.getByText('pictionary_setup.exe')).toBeVisible();
  31 |   await page.getByRole('button', { name: /Solo Play/i }).click();
  32 |   
  33 |   // Verify Game Window (using flexible locator)
  34 |   await expect(page.locator('.glass-window').filter({ hasText: /pictionary/i }).first()).toBeVisible();
  35 |   
  36 |   // Close Pictionary
  37 |   await page.getByLabel('Close').first().click();
  38 |   
  39 |   // Handle Confirmation Dialog
  40 |   await page.getByRole('button', { name: /Confirm/i }).click();
  41 |   
  42 |   // Wait for React state to propagate and unmount
  43 |   await page.waitForTimeout(500);
  44 |   
  45 |   // Verify back in Hub (wait for unmount of specific window)
  46 |   await expect(page.locator('.glass-window').filter({ hasText: /^pictionary\.exe$/i })).toHaveCount(0, { timeout: 5000 });
  47 |   await expect(page.getByText('activities_hub.exe')).toBeVisible();
  48 | });
  49 | 
```