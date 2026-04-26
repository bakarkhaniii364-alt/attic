import { Page } from '@playwright/test';

/**
 * Mocks a logged-in session by setting the necessary localStorage keys.
 * This assumes the app can handle a session-less state if these keys are present,
 * or we might need to actually perform a login.
 * 
 * For real E2E, we should perform a real login.
 */
export async function loginAsTestUser(page: Page, email: string) {
  await page.goto('/signin');
  await page.getByPlaceholder('you@love.com').fill(email);
  await page.getByPlaceholder('••••••••').fill('password123'); // Assume standard test password
  await page.getByRole('button', { name: 'enter attic' }).click();
}
