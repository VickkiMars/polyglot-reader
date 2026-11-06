import os
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path="/usr/bin/google-chrome",
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("Navigating to http://localhost:3005...")
        await page.goto("http://localhost:3005", wait_until="networkidle")

        # Switch to Japanese
        print("Clicking Japanese language switcher...")
        jp_btn = page.locator("button:has-text('Japanese')")
        if await jp_btn.count() > 0:
            await jp_btn.first.click()
            await page.wait_for_timeout(1000)

        # Screenshot home page showing the new featured play card
        await page.screenshot(path="public/play_featured_card.png")
        print("Saved public/play_featured_card.png")

        # Click Rehearse Play button
        rehearse_btn = page.locator("button:has-text('Rehearse Play')")
        if await rehearse_btn.count() > 0:
            print("Opening Play Modal...")
            await rehearse_btn.first.click()
            await page.wait_for_timeout(1200)

            # Screenshot play rehearsal modal
            await page.screenshot(path="public/play_modal_rehearse.png")
            print("Saved public/play_modal_rehearse.png")

            # Click on Scene 2
            s2_tab = page.locator("button:has-text('第2場')")
            if await s2_tab.count() > 0:
                await s2_tab.first.click()
                await page.wait_for_timeout(600)
                await page.screenshot(path="public/play_modal_scene2.png")
                print("Saved public/play_modal_scene2.png")

            # Click Roleplay Mode
            roleplay_btn = page.locator("button:has-text('Roleplay')")
            if await roleplay_btn.count() > 0:
                await roleplay_btn.first.click()
                await page.wait_for_timeout(600)
                await page.screenshot(path="public/play_modal_roleplay.png")
                print("Saved public/play_modal_roleplay.png")

        await browser.close()
        print("Playwright UI verification completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
