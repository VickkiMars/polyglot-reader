import sys
import os
import time
from playwright.sync_api import sync_playwright

def main():
    print("Launching browser for Russian UI verification...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/google-chrome")
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # 1. Load Homepage
        print("Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000", wait_until="networkidle")
        time.sleep(2)

        # 2. Check initial switcher and switch to Russian
        print("Checking language buttons in Header...")
        russian_btn = page.locator("header button:has-text('Russian'), header button:has-text('ТРКИ')").first
        print(f"Clicking Russian button: {russian_btn.inner_text()}")
        russian_btn.click()
        time.sleep(1)

        # 3. Verify Hero content
        print("Hero text content:")
        print(page.locator("section").first.inner_text())

        # 4. Verify FilterBar TORFL level chips
        for level in ["All", "A1", "A2", "B1", "B2", "C1", "C2"]:
            chip = page.locator(f"button:has-text('{level}')").first
            assert chip.is_visible(), f"TORFL level chip '{level}' not found in FilterBar"
        print("✓ FilterBar TORFL level chips (A1-C2) verified")

        # 5. Verify Lesson Cards show Russian content & 'Русский' watermark seal
        first_card = page.locator("article").first
        seal = page.locator("text=Русский").first
        assert seal.is_visible(), "Watermark seal 'Русский' not visible on lesson cards"
        print("✓ Lesson cards 'Русский' seal verified")

        # Take screenshot of Russian track home
        os.makedirs("data/screenshots", exist_ok=True)
        page.screenshot(path="data/screenshots/russian_home.png")
        print("✓ Saved screenshot to data/screenshots/russian_home.png")

        # 6. Test FilterBar Search
        search_input = page.locator("input[placeholder*='Russian']").first
        assert search_input.is_visible(), "Russian search input not visible"
        search_input.fill("день")
        time.sleep(0.5)
        filtered_count = page.locator("article").count()
        print(f"✓ Search for 'день' yielded {filtered_count} stories")
        assert filtered_count > 0, "Search for 'день' should return at least one story"
        search_input.fill("")
        time.sleep(0.5)

        # 7. Open Story Modal for 'A Happy Day'
        print("Opening modal for Story 23410 ('A Happy Day' / 'Счастливый день')...")
        card = page.locator("article:has-text('A Happy Day')").first
        card.click()
        time.sleep(1)

        # Verify modal elements
        modal = page.locator("div[role='dialog']").first
        assert modal.is_visible(), "Story reader modal did not open"
        
        # Verify Russian audio src
        audio = page.locator("audio").first
        audio_src = audio.get_attribute("src") or ""
        print(f"✓ Story audio source: {audio_src}")
        assert "russian" in audio_src, f"Audio source '{audio_src}' does not contain 'russian'"

        # Verify translit toggle button
        translit_toggle = page.locator("button:has-text('Translit'):visible").first
        assert translit_toggle.is_visible(), "Translit toggle button not visible"
        print(f"✓ Visible translit toggle button verified: {translit_toggle.inner_text()}")

        # Verify ruby annotations exist in modal
        ruby_count = page.locator("ruby").count()
        print(f"✓ Found {ruby_count} <ruby> elements in story reader")
        assert ruby_count > 0, "Expected ruby elements for Russian stress/transliteration"

        # Switch to Vocabulary Tab
        vocab_tab_btn = page.locator("button:has-text('Vocabulary'):visible").first
        assert vocab_tab_btn.is_visible(), "Vocabulary tab button not visible"
        vocab_tab_btn.click()
        time.sleep(0.5)

        # Verify Vocabulary Table
        vocab_table = page.locator("table").first
        assert vocab_table.is_visible(), "Vocabulary table not found in reader modal"
        vocab_rows = page.locator("table tbody tr").count()
        print(f"✓ Found {vocab_rows} vocabulary rows in vocabulary table")
        assert vocab_rows > 0, "Vocabulary table should have rows"

        page.screenshot(path="data/screenshots/russian_reader_modal.png")
        print("✓ Saved screenshot to data/screenshots/russian_reader_modal.png")

        # Close modal
        close_btn = page.locator("button[aria-label='Close reader']").first
        if close_btn.is_visible():
            close_btn.click()
        else:
            page.keyboard.press("Escape")
        time.sleep(1)

        # 8. Test Offline Download Modal
        print("Testing Offline Download Modal...")
        offline_btn = page.locator("button[aria-label='Install App and Offline Audio'], button:has-text('Install App')").first
        assert offline_btn.is_visible(), "Offline pack button not visible in header"
        offline_btn.click()
        time.sleep(1)
            
        # Check Russian pack in modal
        russian_pack = page.locator("text=Russian (ТРКИ)").first
        assert russian_pack.is_visible(), "Russian track pack not visible in offline modal"
        print("✓ Offline modal displays Russian language pack successfully")
        page.screenshot(path="data/screenshots/offline_modal.png")
        print("✓ Saved screenshot to data/screenshots/offline_modal.png")

        print("\nAll Russian UI & Pedagogical Feature verifications passed successfully!")
        browser.close()

if __name__ == "__main__":
    main()
