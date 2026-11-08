"""Capture the README screenshots for Recap Studio.

Runs against the local dev server using the system Chromium build.

Usage
    npm run dev            # in one shell
    npm run screenshots    # in another

The editor shots seed a demo project through the development-only store bridge
(`window.__recapStore`) so the timeline, inspector and preview show real
content instead of the empty state.
"""

import asyncio
import pathlib

from playwright.async_api import async_playwright

BASE = "http://localhost:12000"
OUT = pathlib.Path("docs/screenshots")
CHROMIUM = "/usr/bin/chromium"

DESKTOP = {"width": 1440, "height": 900}
NLE = {"width": 1600, "height": 1000}
PHONE = {"width": 430, "height": 932}

# A demo project so the editor screenshots are not empty.
SEED = """() => {
  const s = window.__recapStore.editor.getState();
  s.setSource({ kind: 'file', ref: 'demo.mp4', title: 'signal-lost-1080p.mp4', durationSec: 96 });
  s.loadSample();
  s.setPlayhead(6.4);
  s.setInspectorTab('clip');
}"""


async def settle(page, ms=1500):
    await page.wait_for_timeout(ms)


async def shoot(page, name, viewport, full_page=False):
    target = OUT / f"{name}.png"
    await page.screenshot(path=str(target), full_page=full_page)
    print(f"  {target.name:22s} {viewport['width']}x{viewport['height']}  {target.stat().st_size // 1024} KB")


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path=CHROMIUM,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )

        # ---- desktop pages -------------------------------------------------
        for name, route in [
            ("landing", "/"),
            ("api-settings", "/api-settings"),
            ("download", "/download"),
        ]:
            ctx = await browser.new_context(viewport=DESKTOP, device_scale_factor=2, color_scheme="dark")
            page = await ctx.new_page()
            await page.goto(f"{BASE}{route}", wait_until="networkidle")
            await settle(page)
            await shoot(page, name, DESKTOP)
            await ctx.close()

        # ---- desktop editor (the NLE layout) -------------------------------
        ctx = await browser.new_context(viewport=NLE, device_scale_factor=2, color_scheme="dark")
        page = await ctx.new_page()
        await page.goto(f"{BASE}/editor", wait_until="networkidle")
        await settle(page, 900)
        await page.evaluate(SEED)
        await settle(page, 1600)
        await shoot(page, "editor-desktop", NLE)

        # Effects tab so the inspector shows the frame/watermark controls.
        await page.evaluate("() => window.__recapStore.editor.getState().setInspectorTab('effects')")
        await settle(page, 900)
        await shoot(page, "editor-inspector", NLE)
        await ctx.close()

        # ---- mobile editor -------------------------------------------------
        ctx = await browser.new_context(
            viewport=PHONE, device_scale_factor=3, color_scheme="dark", is_mobile=True, has_touch=True
        )
        page = await ctx.new_page()
        await page.goto(f"{BASE}/editor", wait_until="networkidle")
        await settle(page, 900)
        await page.evaluate(SEED)
        await settle(page, 1600)
        await shoot(page, "editor-mobile", PHONE)
        await ctx.close()

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
