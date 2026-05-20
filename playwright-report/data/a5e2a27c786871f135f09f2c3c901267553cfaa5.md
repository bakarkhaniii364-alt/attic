# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> Dashboard to Chat navigation and unmounting
- Location: tests\navigation.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /online/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /online/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - img [ref=e6] [cursor=pointer]
    - generic:
      - generic [ref=e13]: Bliss
      - generic [ref=e16]:
        - button [ref=e17] [cursor=pointer]:
          - img [ref=e18]
        - slider [ref=e22] [cursor=pointer]: "0.4"
      - generic [ref=e23]:
        - button [ref=e24] [cursor=pointer]:
          - img [ref=e25]
        - button [ref=e27] [cursor=pointer]:
          - img [ref=e28]
        - button [ref=e30] [cursor=pointer]:
          - img [ref=e31]
  - generic [ref=e34]:
    - generic [ref=e35]:
      - heading "User B | offline" [level=2] [ref=e41] [cursor=pointer]
      - generic [ref=e43]:
        - generic [ref=e44]:
          - button "Voice Call" [ref=e45] [cursor=pointer]:
            - img [ref=e46]
          - button "Video Call" [ref=e48] [cursor=pointer]:
            - img [ref=e49]
        - button "Close" [ref=e52] [cursor=pointer]:
          - img [ref=e53]
    - generic [ref=e58]:
      - generic [ref=e59]:
        - generic [ref=e60]: "-- connection secured --"
        - button "↑ Load Older Messages" [ref=e61] [cursor=pointer]
      - generic [ref=e64]:
        - generic [ref=e65]:
          - button [ref=e66] [cursor=pointer]:
            - img [ref=e67]
          - button [ref=e69] [cursor=pointer]:
            - img [ref=e70]
        - textbox "type a message..." [ref=e74]
        - button [ref=e75] [cursor=pointer]:
          - img [ref=e76]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAsTestUser } from './utils';
  3  | 
  4  | test('Dashboard to Chat navigation and unmounting', async ({ page }) => {
  5  |   const sessionId = Math.random().toString(36).substring(2, 7);
  6  |   await loginAsTestUser(page, `userA_${sessionId}`);
  7  |   
  8  |   // 2. Open Chat
  9  |   await page.getByRole('button', { name: /chat/i }).click();
> 10 |   await expect(page.getByRole('heading', { name: /online/i })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  11 |   
  12 |   // 3. Close Chat using the aria-label
  13 |   await page.getByLabel('Close').first().click();
  14 |   
  15 |   // 4. Verify unmounted (not just hidden)
  16 |   await expect(page.getByRole('heading', { name: /online/i })).not.toBeAttached();
  17 | });
  18 | 
  19 | test('Activities Hub to Pictionary and back', async ({ page }) => {
  20 |   const sessionId = Math.random().toString(36).substring(2, 7);
  21 |   await loginAsTestUser(page, `userA_${sessionId}`);
  22 |   
  23 |   // Open Games (Arcade)
  24 |   await page.getByRole('button', { name: /arcade/i }).click();
  25 |   await expect(page.getByText('activities_hub.exe')).toBeVisible();
  26 |   
  27 |   // Select Memory Match (which has Solo mode)
  28 |   await page.getByText('Memory Match', { exact: true }).click();
  29 |   
  30 |   // Handle Setup Window
  31 |   await expect(page.getByText('memory_setup.exe')).toBeVisible();
  32 |   await page.getByRole('button', { name: /Solo/i }).first().click();
  33 |   await page.getByRole('button', { name: /Start Game/i }).click();
  34 |   
  35 |   // Verify Game Window (using flexible locator)
  36 |   await expect(page.locator('.glass-window').filter({ hasText: /memory/i }).first()).toBeVisible();
  37 |   
  38 |   // Close Memory Match
  39 |   await page.locator('.glass-window').filter({ hasText: /memory/i }).getByLabel('Close').click();
  40 |   
  41 |   // Handle Confirmation Dialog
  42 |   await expect(page.getByText(/Progress may be lost/i)).toBeVisible({ timeout: 10000 });
  43 |   await page.getByRole('button', { name: 'Confirm' }).click();
  44 |   
  45 |   // Wait for React state to propagate and unmount
  46 |   await page.waitForTimeout(500);
  47 |   
  48 |   // Verify back in Hub (wait for unmount of specific window)
  49 |   await expect(page.locator('.glass-window').filter({ hasText: /^memory\.exe$/i })).toHaveCount(0, { timeout: 5000 });
  50 |   await expect(page.getByText('memory_setup.exe')).toBeVisible();
  51 | });
  52 | 
```