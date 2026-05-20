# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat.spec.ts >> Real-time message delivery between two users
- Location: tests\chat.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Hello from A 1779293292126')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Hello from A 1779293292126')

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
        - generic [ref=e62]:
          - generic [ref=e63]:
            - button [ref=e65] [cursor=pointer]:
              - img [ref=e66]
            - generic [ref=e71]: Hello from A 1779293292126
          - img [ref=e75]
      - generic [ref=e79]:
        - generic [ref=e80]:
          - button [ref=e81] [cursor=pointer]:
            - img [ref=e82]
          - button [ref=e84] [cursor=pointer]:
            - img [ref=e85]
        - textbox "type a message..." [active] [ref=e89]
        - button [ref=e90] [cursor=pointer]:
          - img [ref=e91]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAsTestUser } from './utils';
  3  | 
  4  | test('Real-time message delivery between two users', async ({ browser }) => {
  5  |   const contextA = await browser.newContext();
  6  |   const contextB = await browser.newContext();
  7  |   
  8  |   const pageA = await contextA.newPage();
  9  |   const pageB = await contextB.newPage();
  10 | 
  11 |   // Pipe console logs to terminal for debugging
  12 |   pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  13 |   pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  14 |   
  15 |   const sessionId = Math.random().toString(36).substring(2, 7);
  16 |   await loginAsTestUser(pageA, `userA_${sessionId}`);
  17 |   await loginAsTestUser(pageB, `userB_${sessionId}`);
  18 |   
  19 |   // Both open chat
  20 |   await pageA.getByTestId('app-icon-chat').click();
  21 |   await pageB.getByTestId('app-icon-chat').click();
  22 |   
  23 |   // User A sends message
  24 |   const testMessage = `Hello from A ${Date.now()}`;
  25 |   await pageA.getByPlaceholder('type a message...').fill(testMessage);
  26 |   await pageA.keyboard.press('Enter');
  27 |   
  28 |   // Verify message appears on B
> 29 |   await expect(pageB.getByText(testMessage)).toBeVisible({ timeout: 5000 });
     |                                              ^ Error: expect(locator).toBeVisible() failed
  30 | });
  31 | 
  32 | test('Typing indicator sync', async ({ browser }) => {
  33 |   const contextA = await browser.newContext();
  34 |   const contextB = await browser.newContext();
  35 |   
  36 |   const pageA = await contextA.newPage();
  37 |   const pageB = await contextB.newPage();
  38 | 
  39 |   pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  40 |   pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  41 |   
  42 |   const sessionId = Math.random().toString(36).substring(2, 7);
  43 |   await loginAsTestUser(pageA, `userA_${sessionId}`);
  44 |   await loginAsTestUser(pageB, `userB_${sessionId}`);
  45 |   
  46 |   await pageA.getByTestId('app-icon-chat').click();
  47 |   await pageB.getByTestId('app-icon-chat').click();
  48 |   
  49 |   // User A types
  50 |   await pageA.getByPlaceholder('type a message...').type('He');
  51 |   
  52 |   // Verify indicator on B
  53 |   await expect(pageB.getByText(/is typing/i)).toBeVisible();
  54 |   
  55 |   // User A stops
  56 |   await pageA.getByPlaceholder('type a message...').fill('');
  57 |   
  58 |   // Verify indicator disappears on B after timeout
  59 |   await expect(pageB.getByText(/is typing/i)).not.toBeVisible({ timeout: 5000 });
  60 | });
  61 | 
```