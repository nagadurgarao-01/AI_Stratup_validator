"""
End-to-End Playwright Tests — AI Startup Idea Validator

Tests the full user flow:
  1. Landing page loads correctly
  2. Navigation to /validate works
  3. Hypothesis input form is functional
  4. Template button fills the textarea
  5. Validate button is disabled when input is too short
  6. Validate button is enabled with valid input
  7. Backend error state is shown correctly (no API key configured)
  8. Report page shows "not found" gracefully for unknown IDs

Server must be running on localhost:3000 before executing this script.
Run: npm run dev (in /frontend)
"""
from playwright.sync_api import sync_playwright, expect
import sys
import time

BASE_URL = "http://localhost:3000"

VALID_HYPOTHESIS = (
    "Freelance graphic designers struggle to write winning project proposals "
    "because they lack business writing skills, causing them to lose 30% of "
    "potential clients to competitors with inferior design skills but better pitches."
)

SHORT_HYPOTHESIS = "Short"

RESULTS: list[tuple[str, str, str]] = []  # (test_name, status, detail)


def record(name: str, passed: bool, detail: str = "") -> None:
    status = "PASS" if passed else "FAIL"
    icon = "✓" if passed else "✗"
    RESULTS.append((name, status, detail))
    print(f"  {icon} [{status}] {name}" + (f" — {detail}" if detail else ""))


def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("\n[1/4] Landing Page Tests")
        print("─" * 50)

        # Test 1: Landing page loads
        page.goto(BASE_URL)
        page.wait_for_load_state("networkidle")
        title = page.title()
        record(
            "Landing page title is set",
            "ValidateAI" in title or "Startup" in title,
            f'title="{title}"',
        )

        # Test 2: Hero heading is visible
        h1 = page.locator("h1").first
        record(
            "H1 heading is visible",
            h1.is_visible(),
            h1.text_content()[:60] if h1.is_visible() else "not found",
        )

        # Test 3: CTA button links to /validate
        cta = page.locator("a[href='/validate']").first
        record("CTA button points to /validate", cta.count() > 0)

        # Test 4: Sample viability scores are rendered
        scores = page.locator("text=/\\d+\\/100/").all()
        record("Sample viability scores rendered", len(scores) >= 3, f"{len(scores)} score badges found")

        # Test 5: Features section heading visible
        features_heading = page.locator("text=Everything You Need").first
        record("Features section renders", features_heading.is_visible())

        print("\n[2/4] Validate Page — Input Tests")
        print("─" * 50)

        page.goto(f"{BASE_URL}/validate")
        page.wait_for_load_state("networkidle")

        # Test 6: Validate page h1
        h1 = page.locator("h1").first
        record(
            "Validate page heading visible",
            h1.is_visible(),
            h1.text_content()[:50] if h1.is_visible() else "",
        )

        # Test 7: Hypothesis textarea exists
        textarea = page.locator("#hypothesis-input")
        record("Hypothesis textarea is present", textarea.count() > 0)

        # Test 8: Start button is disabled when textarea is empty
        btn = page.locator("#validate-btn")
        is_disabled = btn.is_disabled()
        record("Start button disabled when input is empty", is_disabled)

        # Test 9: Start button is disabled with short input
        textarea.fill(SHORT_HYPOTHESIS)
        time.sleep(0.3)
        is_disabled_short = btn.is_disabled()
        record("Start button disabled with <20 char input", is_disabled_short)

        # Test 10: Use Template button fills the textarea
        template_btn = page.locator("#use-template-btn")
        template_btn.click()
        time.sleep(0.3)
        template_value = textarea.input_value()
        record(
            "Use Template button fills textarea",
            len(template_value) > 20,
            f"{len(template_value)} chars filled",
        )

        # Test 11: Start button enabled with valid input
        textarea.fill(VALID_HYPOTHESIS)
        time.sleep(0.3)
        is_enabled = not btn.is_disabled()
        record(
            "Start button enabled with valid hypothesis",
            is_enabled,
            f"{len(VALID_HYPOTHESIS)} chars",
        )

        # Test 12: Char counter updates
        char_count_el = page.locator(f"text=/{len(VALID_HYPOTHESIS)} / 2000/").first
        # Accept any counter showing the right number
        page_text = page.inner_text("body")
        char_shown = str(len(VALID_HYPOTHESIS)) in page_text
        record("Character counter updates correctly", char_shown)

        # Test 13: Sidebar agent pipeline list is visible
        agent_labels = ["Critic Agent", "Market Research", "Competitor Intel"]
        all_visible = all(page.locator(f"text={label}").count() > 0 for label in agent_labels)
        record("Sidebar agent pipeline labels visible", all_visible)

        print("\n[3/4] Backend Connection Test")
        print("─" * 50)

        # Test 14: Clicking Start Validation with no backend → shows error state
        # (Backend isn't running with API key during test, so error is expected)
        btn.click()
        time.sleep(4)  # Wait for SSE timeout / error
        page_text_after = page.inner_text("body")
        entered_progress = any(word in page_text_after for word in [
            "AI Agents Working", "Challenging", "error", "Error", "Could not connect",
            "Validation Failed", "Initializing"
        ])
        record(
            "Clicking validate transitions away from input screen",
            entered_progress,
        )

        print("\n[4/4] Report Page Tests")
        print("─" * 50)

        # Test 15: Unknown report ID shows graceful not-found UI
        page.goto(f"{BASE_URL}/report/nonexistent-test-id-12345")
        page.wait_for_load_state("networkidle")
        page_text = page.inner_text("body")
        not_found = "Not Found" in page_text or "not found" in page_text.lower() or "Start a New" in page_text
        record("Unknown report ID shows graceful not-found page", not_found)

        # Test 16: Not-found page has a link back to /validate
        back_link = page.locator("a[href='/validate']")
        record("Not-found page has link to /validate", back_link.count() > 0)

        browser.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("TEST SUMMARY")
    print("=" * 50)
    passed = sum(1 for _, s, _ in RESULTS if s == "PASS")
    failed = sum(1 for _, s, _ in RESULTS if s == "FAIL")
    print(f"  Passed: {passed}/{len(RESULTS)}")
    print(f"  Failed: {failed}/{len(RESULTS)}")

    if failed > 0:
        print("\nFailed Tests:")
        for name, status, detail in RESULTS:
            if status == "FAIL":
                print(f"  ✗ {name}" + (f" — {detail}" if detail else ""))
        sys.exit(1)
    else:
        print("\nAll tests passed!")
        sys.exit(0)


if __name__ == "__main__":
    print("AI Startup Idea Validator — End-to-End Tests")
    print("=" * 50)
    print(f"Target: {BASE_URL}")
    print("Make sure `npm run dev` is running in /frontend\n")
    run_tests()
