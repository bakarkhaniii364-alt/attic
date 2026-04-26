import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils';

test('Dashboard to Chat navigation and unmounting', async ({ page }) => {
  // 1. Login
  await loginAsTestUser(page, 'test@example.com');
  
  // 2. Open Chat
  await page.getByText('chat', { exact: true }).click();
  await expect(page.getByText('chat_room.exe')).toBeVisible();
  
  // 3. Close Chat using the aria-label
  await page.getByLabel('Close').first().click();
  
  // 4. Verify unmounted (not just hidden)
  await expect(page.getByText('chat_room.exe')).not.toBeAttached();
});

test('Activities Hub to Pictionary and back', async ({ page }) => {
  await loginAsTestUser(page, 'test@example.com');
  
  // Open Games
  await page.getByText('games', { exact: true }).click();
  await expect(page.getByText('activities_hub.exe')).toBeVisible();
  
  // Select Pictionary
  await page.getByText('Pictionary', { exact: true }).click();
  
  // Handle Setup Window
  await expect(page.getByText('pictionary_setup.exe')).toBeVisible();
  await page.getByRole('button', { name: /Solo Play/i }).click();
  
  // Verify Game Window (using flexible locator)
  await expect(page.locator('.glass-window').filter({ hasText: /pictionary/i }).first()).toBeVisible();
  
  // Close Pictionary
  await page.getByLabel('Close').first().click();
  
  // Handle Confirmation Dialog
  await page.getByRole('button', { name: /Confirm/i }).click();
  
  // Wait for React state to propagate and unmount
  await page.waitForTimeout(500);
  
  // Verify back in Hub (wait for unmount of specific window)
  await expect(page.locator('.glass-window').filter({ hasText: /^pictionary\.exe$/i })).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByText('activities_hub.exe')).toBeVisible();
});
