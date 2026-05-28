import { test, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Targeted Mobile UI Screener (No URL Crawling)', async ({ page }) => {
    const mobileDevice = devices['Pixel 7'];
    await page.setViewportSize(mobileDevice.viewport);

    // CONFIGURATION
    const START_URL = 'http://localhost:5173';
    const CLICKS_PER_PAGE = 30; // Max elements to snap on this screen
    let screenshotCount = 1;

    const screenshotDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }

    // 1. INITIAL APP LOAD
    console.log(`🚀 Launching browser at: ${START_URL}`);
    await page.goto(START_URL, { waitUntil: 'load' });

    // 2. PAUSE FOR MANUAL NAVIGATION
    console.log(`\n🛑 PAUSED FOR SETUP:`);
    console.log(`--> 1. Log in to your application.`);
    console.log(`--> 2. MANUALLY click the navigation option or view you want to test (e.g., your games panel).`);
    console.log(`--> 3. Once you are looking at the target screen, click "Resume" (▶) in the Inspector box.`);

    await page.pause();

    console.log(`\n🟢 Commencing UI capture on the current view state...`);
    await page.waitForTimeout(1500);

    const rawTitle = await page.title();
    const pageTitle = (rawTitle || 'target_view').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // ==========================================
    // AUTOMATED SCROLL DOWN & BACK UP
    // ==========================================
    console.log(`📜 Scrolling page layout...`);
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || (window.innerHeight + window.scrollY) >= scrollHeight) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 60);
        });
    });
    await page.waitForTimeout(1000);

    // SNAP THE FULL PAGE HEIGHT
    console.log(`📸 Snapping base viewport snapshot...`);
    await page.screenshot({
        path: `screenshots/${String(screenshotCount++).padStart(3, '0')}-${pageTitle}-00-mainscroll.png`,
        fullPage: true
    });

    // ==========================================
    // INTERACTIVE ELEMENT CLICKING LOOP
    // ==========================================
    // Re-evaluates the DOM fresh on every single loop iteration to handle shifting states
    let clickedCount = 0;

    for (let attempt = 0; attempt < CLICKS_PER_PAGE; attempt++) {
        // Re-fetch the elements every loop to avoid "stale element" errors when layouts change
        const clickables = await page.locator('button, [role="button"], [role="tab"], .hamburger, .menu-toggle, [class*="menu"], [class*="btn"]').all();

        // Safely break if we run out of targets entirely
        if (attempt >= clickables.length) {
            console.log(`ℹ️ No more clickable targets found on this view.`);
            break;
        }

        const element = clickables[attempt];

        try {
            if (await element.isVisible({ timeout: 500 }) && await element.isEnabled({ timeout: 500 })) {
                const textRaw = await element.innerText().catch(() => '');

                // Safety skip: If the button says Log Out or Sign Out, do not click it!
                if (textRaw.toLowerCase().includes('log') || textRaw.toLowerCase().includes('signout') || textRaw.toLowerCase().includes('exit')) {
                    console.log(`   ⏭️ Skipping potentially destructive button: "${textRaw.trim()}"`);
                    continue;
                }

                const elementId = textRaw.trim().substring(0, 12).replace(/[^a-z0-9]/gi, '_').toLowerCase() || `elem_${attempt}`;
                console.log(`   👉 Tapping [${clickedCount + 1}/${CLICKS_PER_PAGE}]: "${textRaw.trim() || `Index ${attempt}`}"`);

                await element.scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => { });
                await element.click({ timeout: 2000, force: true });

                // Wait 1.5 seconds for game engine details or overlay elements to paint
                await page.waitForTimeout(1500);

                // Take the screenshot
                await page.screenshot({
                    path: `screenshots/${String(screenshotCount++).padStart(3, '0')}-${pageTitle}-tap-${elementId}.png`
                });
                clickedCount++;

                // Self-heal: If a modal popped up, close it so it doesn't break the layout
                const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel"), [aria-label="Close"], .modal-close').first();
                if (await closeButton.isVisible({ timeout: 400 })) {
                    await closeButton.click().catch(() => { });
                    await page.waitForTimeout(800);
                }
            }
        } catch (err) {
            console.log(`   ⚠️ Interaction point changed or hidden by blocker modal. Pausing layout engine...`);
            await page.pause(); // Freezes if a PIN or blocker blocks the viewport
            continue;
        }
    }

    console.log(`\n🎉 VIEW COMPLETE! All images dropped into your /screenshots directory.`);
});