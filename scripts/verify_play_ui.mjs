import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }
  });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3005...");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });

  // Switch to Japanese language track
  console.log("Switching to Japanese language track...");
  const jpButton = page.locator("button:has-text('Japanese')");
  if (await jpButton.count() > 0) {
    await jpButton.first().click();
    await page.waitForTimeout(1000);
  }

  // Capture Home page with Japanese Play Featured Card
  await page.screenshot({ path: "play_featured_card.png" });
  console.log("Captured play_featured_card.png");

  // Click on "Rehearse Play" button
  console.log("Clicking Rehearse Play button...");
  const rehearseBtn = page.locator("button:has-text('Rehearse Play')");
  if (await rehearseBtn.count() > 0) {
    await rehearseBtn.first().click();
    await page.waitForTimeout(1500);

    // Capture Play Rehearsal Modal
    await page.screenshot({ path: "play_rehearsal_modal.png" });
    console.log("Captured play_rehearsal_modal.png");

    // Click on Roleplay button
    const roleplayBtn = page.locator("button:has-text('Roleplay')");
    if (await roleplayBtn.count() > 0) {
      await roleplayBtn.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: "play_roleplay_mode.png" });
      console.log("Captured play_roleplay_mode.png");
    }
  }

  await browser.close();
}

main().catch(console.error);
