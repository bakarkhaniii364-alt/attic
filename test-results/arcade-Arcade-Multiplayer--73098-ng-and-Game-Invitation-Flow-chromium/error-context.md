# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: arcade.spec.ts >> Arcade Multiplayer Suite >> Two-Player Pairing and Game Invitation Flow
- Location: tests\arcade.spec.ts:6:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('lobby_tictactoe.exe')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('lobby_tictactoe.exe')

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
      - heading "lobby_tictactoe.exe" [level=2] [ref=e41]
      - button "Close" [ref=e44] [cursor=pointer]:
        - img [ref=e45]
    - generic [ref=e49]:
      - heading "Arcade Lobby" [level=2] [ref=e50]
      - generic [ref=e51]:
        - generic [ref=e52]: Tic-Tac-Toe
        - generic [ref=e53]: "Mode: Online"
      - generic [ref=e54]:
        - generic [ref=e55]:
          - img [ref=e57]
          - generic [ref=e60]: Player 1
          - generic [ref=e61]: User A
          - generic [ref=e62]: SYNCING...
        - generic [ref=e64]: VS
        - generic [ref=e65]:
          - img [ref=e67]
          - generic [ref=e69]: Player 2
          - generic [ref=e70]: SYNCING...
          - generic [ref=e71]: SYNCING...
      - generic [ref=e72]:
        - button "Waiting for partner..." [disabled]
        - button "Resend Invite" [ref=e73] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { loginAsTestUser } from './utils';
  3   | 
  4   | test.describe('Arcade Multiplayer Suite', () => {
  5   |   
  6   |   test('Two-Player Pairing and Game Invitation Flow', async ({ browser }) => {
  7   |     // Isolated "incognito" contexts for User A and User B
  8   |     const contextA = await browser.newContext();
  9   |     const contextB = await browser.newContext();
  10  |     
  11  |     const pageA = await contextA.newPage();
  12  |     const pageB = await contextB.newPage();
  13  | 
  14  |     // Pipe console logs for easier debugging during test development
  15  |     pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  16  |     pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  17  | 
  18  |     // Use a unique session ID for this test run to avoid cross-test interference
  19  |     const testId = Math.random().toString(36).substring(2, 7);
  20  |     await loginAsTestUser(pageA, `userA_${testId}`);
  21  |     await loginAsTestUser(pageB, `userB_${testId}`);
  22  |     
  23  |     // Step 1: User A navigates to Arcade and selects Tic-Tac-Toe
  24  |     await pageA.getByTestId('app-icon-arcade').click();
  25  |     await expect(pageA.getByText('activities_hub.exe')).toBeVisible({ timeout: 10000 });
  26  |     
  27  |     await pageA.getByTestId('game-card-tictactoe').click();
  28  |     await expect(pageA.getByText('tictactoe_setup.exe')).toBeVisible();
  29  |     
  30  |     // Step 2: User A selects "With Partner" and proceeds to Lobby
  31  |     await pageA.getByRole('button', { name: /With Partner/i }).click();
  32  |     await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
  33  |     
  34  |     // Assert User A is in the lobby
  35  |     await expect(pageA.getByText('lobby_tictactoe.exe')).toBeVisible();
  36  |     await expect(pageA.getByText(/Waiting for partner/i)).toBeVisible();
  37  | 
  38  |     // Directly sync arcade lobby state from pageA to pageB
  39  |     const lobbyState = await pageA.evaluate(() => localStorage.getItem('attic_test_arcade_lobby'));
  40  |     if (lobbyState) {
  41  |       await pageB.evaluate((state) => {
  42  |         localStorage.setItem('attic_test_arcade_lobby', state);
  43  |         window.dispatchEvent(new StorageEvent('storage', {
  44  |           key: 'attic_test_arcade_lobby',
  45  |           newValue: state
  46  |         }));
  47  |       }, lobbyState);
  48  |     }
  49  | 
  50  | 
  51  |     // Step 3: User B (who might be anywhere) receives the global invitation modal
  52  |     // We'll wait for the modal to appear on Page B
  53  |     await expect(pageB.getByRole('heading', { name: /invited you/i })).toBeVisible({ timeout: 15000 });
  54  |     await expect(pageB.locator('h3').filter({ hasText: /Tic-Tac-Toe/i })).toBeVisible();
  55  | 
  56  |     // Step 4: User B accepts the invite
  57  |     await pageB.getByRole('button', { name: /Accept & Join/i }).click();
  58  | 
  59  |     // Directly sync arcade lobby state from pageB back to pageA
  60  |     const lobbyStateB = await pageB.evaluate(() => localStorage.getItem('attic_test_arcade_lobby'));
  61  |     if (lobbyStateB) {
  62  |       await pageA.evaluate((state) => {
  63  |         localStorage.setItem('attic_test_arcade_lobby', state);
  64  |         window.dispatchEvent(new StorageEvent('storage', {
  65  |           key: 'attic_test_arcade_lobby',
  66  |           newValue: state
  67  |         }));
  68  |       }, lobbyStateB);
  69  |     }
  70  | 
  71  | 
  72  |     // Step 5: Assert both users are now in the same lobby and READY
> 73  |     await expect(pageB.getByText('lobby_tictactoe.exe')).toBeVisible();
      |                                                          ^ Error: expect(locator).toBeVisible() failed
  74  |     await expect(pageA.getByText('P2').first()).toBeVisible({ timeout: 10000 });
  75  |     await expect(pageA.getByRole('button', { name: /START GAME/i })).toBeVisible();
  76  |     await expect(pageB.getByText(/Partner is Waiting/i)).not.toBeVisible(); // Should be inside lobby now
  77  | 
  78  |     // Step 6: User A starts the game
  79  |     await pageA.getByRole('button', { name: /START GAME/i }).click();
  80  | 
  81  |     // Directly sync arcade lobby state from pageA to pageB
  82  |     const lobbyStatePlaying = await pageA.evaluate(() => localStorage.getItem('attic_test_arcade_lobby'));
  83  |     if (lobbyStatePlaying) {
  84  |       await pageB.evaluate((state) => {
  85  |         localStorage.setItem('attic_test_arcade_lobby', state);
  86  |         window.dispatchEvent(new StorageEvent('storage', {
  87  |           key: 'attic_test_arcade_lobby',
  88  |           newValue: state
  89  |         }));
  90  |       }, lobbyStatePlaying);
  91  |     }
  92  | 
  93  |     // Assert both see the game eventually (skip fleeting countdown test)
  94  |     await expect(pageA.locator('canvas').or(pageA.locator('.retro-border')).or(pageA.locator('.game-container')).first()).toBeVisible({ timeout: 15000 });
  95  |     await expect(pageB.locator('canvas').or(pageB.locator('.retro-border')).or(pageB.locator('.game-container')).first()).toBeVisible({ timeout: 15000 });
  96  |   });
  97  | 
  98  |   test('Invite all games - Smoke Test for Invitations', async ({ browser }) => {
  99  |     const contextA = await browser.newContext();
  100 |     const contextB = await browser.newContext();
  101 |     const pageA = await contextA.newPage();
  102 |     const pageB = await contextB.newPage();
  103 | 
  104 |     const testId = Math.random().toString(36).substring(2, 7);
  105 |     await loginAsTestUser(pageA, `userA_${testId}`);
  106 |     await loginAsTestUser(pageB, `userB_${testId}`);
  107 | 
  108 |     const gamesToTest = ['Chess'];
  109 | 
  110 |     for (const gameTitle of gamesToTest) {
  111 |       console.log(`Testing invitation for: ${gameTitle}`);
  112 |             // User A invites
  113 |       await pageA.getByTestId('app-icon-arcade').click();
  114 |       await expect(pageA.getByText('activities_hub.exe')).toBeVisible({ timeout: 10000 });
  115 |       // Use a more specific locator for the catalog item
  116 |       await pageA.getByTestId(`game-card-${gameTitle.toLowerCase().replace(/ /g, '').replace('8-ballpool', 'pool')}`).click();
  117 |       await pageA.getByRole('button', { name: /With Partner/i }).click();
  118 |       await pageA.getByRole('button', { name: /Proceed to Lobby/i }).click();
  119 |       
  120 |       // Directly sync arcade lobby state from pageA to pageB
  121 |       const lobbyState = await pageA.evaluate(() => localStorage.getItem('attic_test_arcade_lobby'));
  122 |       if (lobbyState) {
  123 |         await pageB.evaluate((state) => {
  124 |           localStorage.setItem('attic_test_arcade_lobby', state);
  125 |           window.dispatchEvent(new StorageEvent('storage', {
  126 |             key: 'attic_test_arcade_lobby',
  127 |             newValue: state
  128 |           }));
  129 |         }, lobbyState);
  130 |       }
  131 | 
  132 |       // User B accepts
  133 |       // Wait for the modal title specifically
  134 |       await expect(pageB.getByRole('heading', { name: 'incoming_invite.exe' })).toBeVisible({ timeout: 15000 });
  135 |       await expect(pageB.locator('h3').filter({ hasText: gameTitle }).first()).toBeVisible();
  136 |       await pageB.getByRole('button', { name: /Accept & Join/i }).click();
  137 | 
  138 |       // Directly sync arcade lobby state from pageB back to pageA
  139 |       const lobbyStateB = await pageB.evaluate(() => localStorage.getItem('attic_test_arcade_lobby'));
  140 |       if (lobbyStateB) {
  141 |         await pageA.evaluate((state) => {
  142 |           localStorage.setItem('attic_test_arcade_lobby', state);
  143 |           window.dispatchEvent(new StorageEvent('storage', {
  144 |             key: 'attic_test_arcade_lobby',
  145 |             newValue: state
  146 |           }));
  147 |         }, lobbyStateB);
  148 |       }
  149 | 
  150 |       
  151 |       // Verify both in lobby
  152 |       await expect(pageA.getByRole('button', { name: /START GAME/i })).toBeVisible({ timeout: 15000 });
  153 |       
  154 |       // Reset pages to dashboard to test next game
  155 |       await pageA.goto('http://localhost:5173/dashboard');
  156 |       await pageB.goto('http://localhost:5173/dashboard');
  157 |     }
  158 |   });
  159 | 
  160 | });
  161 | 
```