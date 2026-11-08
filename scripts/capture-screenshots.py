"""Regenerate the README screenshot.

Produces `docs/screenshots/editor-mobile.png` — the mobile editor — which is the
only image the README embeds.

Usage
    npm run dev            # in one shell
    npm run screenshots    # in another

The project is seeded through the development-only store bridge
(`window.__recapStore`) so the timeline, inspector and preview show real content
instead of the empty state.
"""

import asyncio
import pathlib

from playwright.async_api import async_playwright

BASE = "http://localhost:12000"
OUT = pathlib.Path("docs/screenshots")
CHROMIUM = "/usr/bin/chromium"
PHONE = {"width": 430, "height": 932}

# A demo project so the shot is not an empty state.
SEED = """() => {
  const s = window.__recapStore.editor.getState();
  s.setSource({ kind: 'file', ref: 'demo.mp4', title: 'signal-lost-1080p.mp4', durationSec: 96 });
  s.loadSample();
  s.setPlayhead(6.4);
}"""


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=CHROMIUM,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            viewport=PHONE,
            device_scale_factor=3,
            color_scheme="dark",
            is_mobile=True,
            has_touch=True,
        )
        page = await ctx.new_page()
        await page.goto(f"{BASE}/editor", wait_until="networkidle")
        await page.wait_for_timeout(900)
        await page.evaluate(SEED)
        await page.wait_for_timeout(1600)

        target = OUT / "editor-mobile.png"
        await page.screenshot(path=str(target))
        print(f"  {target}  {PHONE['width']}x{PHONE['height']}  {target.stat().st_size // 1024} KB")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
