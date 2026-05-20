# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: communication.spec.ts >> Communication E2E Suite >> Real-Time Text & Typing
- Location: tests\communication.spec.ts:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Hello from Playwright!')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Hello from Playwright!')

```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - heading "welcome back.exe" [level=2] [ref=e13]
    - button "Close" [ref=e16] [cursor=pointer]:
      - img [ref=e17]
  - generic [ref=e21]:
    - heading "welcome back" [level=2] [ref=e23]
    - generic [ref=e24]:
      - text: email
      - generic [ref=e25]:
        - img [ref=e26]
        - textbox "you@love.com" [active] [ref=e29]
    - generic [ref=e30]:
      - generic [ref=e31]:
        - text: password
        - generic [ref=e32]:
          - img [ref=e33]
          - textbox "••••••••" [ref=e36]
          - button [ref=e37] [cursor=pointer]:
            - img [ref=e38]
      - generic [ref=e41]:
        - generic [ref=e42] [cursor=pointer]:
          - checkbox "remember me" [ref=e43]
          - generic [ref=e44]: remember me
        - link "forgot password?" [ref=e45] [cursor=pointer]:
          - /url: /password-reset
    - button "enter attic" [ref=e46] [cursor=pointer]
    - generic [ref=e49]: or
    - generic [ref=e51]:
      - button "Magic Link" [ref=e52] [cursor=pointer]:
        - img [ref=e53]
        - text: Magic Link
      - button "Facebook" [ref=e56] [cursor=pointer]:
        - img [ref=e57]
        - text: Facebook
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { loginAsTestUser } from './utils';
  3   | 
  4   | test.describe('Communication E2E Suite', () => {
  5   |   
  6   |   test('Real-Time Text & Typing', async ({ browser }) => {
  7   |     const contextA = await browser.newContext();
  8   |     const contextB = await browser.newContext();
  9   |     
  10  |     const pageA = await contextA.newPage();
  11  |     const pageB = await contextB.newPage();
  12  | 
  13  |     // Pipe console logs for debugging
  14  |     pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  15  |     pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  16  | 
  17  |     // Step 1: User A and User B are logged in and paired in isolated contexts
  18  |     const sessionId = Math.random().toString(36).substring(2, 7);
  19  |     await loginAsTestUser(pageA, `userA_${sessionId}`);
  20  |     await loginAsTestUser(pageB, `userB_${sessionId}`);
  21  |     
  22  |     // Both navigate to chat
  23  |     await pageA.getByTestId('app-icon-chat').click();
  24  |     await pageB.getByTestId('app-icon-chat').click();
  25  |     
  26  |     // Step 2: User A types in the chat box (do not press send yet)
  27  |     await pageA.getByPlaceholder('type a message...').click();
  28  |     await pageA.waitForTimeout(1000); // Wait for both to be fully synced
  29  |     await pageA.getByPlaceholder('type a message...').pressSequentially('Hello');
  30  |     
  31  |     // Step 3: Assert that User B's UI displays the "Partner is typing..." indicator
  32  |     await expect(pageB.getByText(/is typing/i)).toBeVisible({ timeout: 5000 });
  33  |     
  34  |     // Step 4: User A sends the message: "Hello from Playwright!"
  35  |     const messageText = "Hello from Playwright!";
  36  |     await pageA.getByPlaceholder('type a message...').fill(messageText);
  37  |     await pageA.keyboard.press('Enter');
  38  |     
  39  |     // Step 5: Assert that User B receives the exact message bubble
> 40  |     await expect(pageB.getByText(messageText)).toBeVisible({ timeout: 10000 });
      |                                                ^ Error: expect(locator).toBeVisible() failed
  41  |     
  42  |     // Step 6: Assert that User A's UI marks the message as "Read" once User B views it
  43  |     // In ChatView, messages are marked as read when the component mounts or updates with unread messages
  44  |     // We look for "seen" text which appears when status is 'read'
  45  |     await pageA.waitForTimeout(2000); 
  46  |     await expect(pageA.getByText(/seen/i)).toBeVisible({ timeout: 10000 });
  47  |   });
  48  | 
  49  |   test('WebRTC Audio/Video Call Flow', async ({ browser }) => {
  50  |     const contextA = await browser.newContext();
  51  |     const contextB = await browser.newContext();
  52  |     
  53  |     const pageA = await contextA.newPage();
  54  |     const pageB = await contextB.newPage();
  55  | 
  56  |     pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  57  |     pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  58  | 
  59  |     // Login and pair
  60  |     const sessionId = Math.random().toString(36).substring(2, 7);
  61  |     await loginAsTestUser(pageA, `userA_${sessionId}`);
  62  |     await loginAsTestUser(pageB, `userB_${sessionId}`);
  63  |     
  64  |     // Both navigate to chat to find the call buttons in the header
  65  |     await pageA.getByTestId('app-icon-chat').click();
  66  |     await pageB.getByTestId('app-icon-chat').click();
  67  |     
  68  |     // Step 1: User A clicks the "Voice Call" button in the chat header
  69  |     await expect(pageA.getByTitle('Voice Call')).toBeVisible();
  70  |     await pageA.getByTitle('Voice Call').click();
  71  |     
  72  |     // Step 2: Assert that User A's UI enters the "Ringing" state
  73  |     // App.jsx: <div className="...">Ringing {partnerName}...</div>
  74  |     await expect(pageA.getByText(/Ringing/i)).toBeVisible({ timeout: 5000 });
  75  |     
  76  |     // Step 3: Assert that User B's UI displays the "Incoming Call" modal
  77  |     await expect(pageB.getByText(/Incoming Voice Call/i)).toBeVisible({ timeout: 10000 });
  78  |     
  79  |     // Step 4: User B clicks the Accept (green phone) button
  80  |     // The Accept button is the second button in the incoming call modal
  81  |     const modal = pageB.locator('div').filter({ hasText: /Incoming Voice Call/i }).last();
  82  |     await modal.locator('button').nth(1).click();
  83  |     
  84  |     // Step 5: Assert that both User A and User B's UIs transition to show the active Call Hub
  85  |     // and that the duration timer appears
  86  |     await expect(pageA.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 15000 });
  87  |     await expect(pageB.getByText(/AUDIO CALL/i)).toBeVisible({ timeout: 15000 });
  88  |     
  89  |     // Verify duration timer (e.g., 0:01)
  90  |     await expect(pageA.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 10000 });
  91  |     await expect(pageB.getByText(/0:0[1-9]/)).toBeVisible({ timeout: 10000 });
  92  |     
  93  |     // Step 6: User A clicks the "End Call" button
  94  |     // The End button has text "End" in the PremiumCallHub
  95  |     await pageA.getByRole('button', { name: /End/i }).click();
  96  |     
  97  |     // Step 7: Assert the Call Hub completely unmounts and disappears for both users
  98  |     await expect(pageA.getByText(/AUDIO CALL/i)).not.toBeVisible({ timeout: 5000 });
  99  |     await expect(pageB.getByText(/AUDIO CALL/i)).not.toBeVisible({ timeout: 5000 });
  100 |   });
  101 | 
  102 | });
  103 | 
```