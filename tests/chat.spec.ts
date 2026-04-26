import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test('Real-time message delivery between two users', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  // Pipe console logs to terminal for debugging
  pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  
  // Note: These must be a paired couple in the DB for this to work in real E2E
  await loginAsTestUser(pageA, 'userA@example.com');
  await loginAsTestUser(pageB, 'userB@example.com');
  
  // Both open chat
  await pageA.getByText('chat', { exact: true }).click();
  await pageB.getByText('chat', { exact: true }).click();
  
  // User A sends message
  const testMessage = `Hello from A ${Date.now()}`;
  await pageA.getByPlaceholder('type a message...').fill(testMessage);
  await pageA.keyboard.press('Enter');
  
  // Verify message appears on B
  await expect(pageB.getByText(testMessage)).toBeVisible({ timeout: 5000 });
});

test('Typing indicator sync', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  pageA.on('console', msg => console.log('PAGE A:', msg.text()));
  pageB.on('console', msg => console.log('PAGE B:', msg.text()));
  
  await loginAsTestUser(pageA, 'userA@example.com');
  await loginAsTestUser(pageB, 'userB@example.com');
  
  await pageA.getByText('chat', { exact: true }).click();
  await pageB.getByText('chat', { exact: true }).click();
  
  // User A types
  await pageA.getByPlaceholder('type a message...').type('He');
  
  // Verify indicator on B
  await expect(pageB.getByText(/is typing/i)).toBeVisible();
  
  // User A stops
  await pageA.getByPlaceholder('type a message...').fill('');
  
  // Verify indicator disappears on B after timeout
  await expect(pageB.getByText(/is typing/i)).not.toBeVisible({ timeout: 5000 });
});
