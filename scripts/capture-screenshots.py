"""Capture README screenshots for Recap Studio.

Renders four key routes against the local dev server using the system
Chromium build (no bundled browser download needed).
"""

import asyncio
import pathlib

from playwright.async_api import async_playwright

BASE = "http://localhost:12000"
OUT = pathlib.Path("docs/screenshots")
CHROMIUM = "/usr/bin/chromium"

# (file stem, route, viewport, full_page, pre_render actions)
PAGES = [
    ("landing", "/", {"width": 1440, "height": 960}, False, None),
    ("editor", "/editor", {"width": 430, "height": 932}, False, "load-sample"),
    ("api-settings", "/api-settings", {"width": 1440, "height": 900}, False, None),
    ("download", "/download", {"width": 1440, "height": 900}, False, None),
]


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=CHROMIUM,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )

        for stem, route, viewport, full_page, action in PAGES:
            context = await browser.new_context(
                viewport=viewport,
                device_scale_factor=2,
                color_scheme="dark",
            )
            page = await context.new_page()
            await page.goto(f"{BASE}{route}", wait_until="networkidle")

            if action == "load-sample":
                # Populate the timeline so the editor is not captured empty.
                await page.get_by_role("button", name="Load sample").click()
                await page.wait_for_timeout(900)

            # Let entry animations settle before the shutter.
            await page.wait_for_timeout(1400)

            target = OUT / f"{stem}.png"
            await page.screenshot(path=str(target), full_page=full_page)
            print(f"  {target}  ({viewport['width']}x{viewport['height']})")
            await context.close()

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
