// Renders every screen in screens.html to mockups/png/<id>.png, at phone
// size, with Playwright's Firefox (installed for the e2e tests).
//   node agentic_docs/plans/nov-game-fixes/mockups/render.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(process.cwd(), "package.json"));
const { firefox } = require("@playwright/test");

const out = join(here, "png");
mkdirSync(out, { recursive: true });
const browser = await firefox.launch();
const page = await browser.newPage({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(join(here, "screens.html")).href);
await page.waitForTimeout(500);
const screens = page.locator("section.screen");
const count = await screens.count();
for (let i = 0; i < count; i++) {
    const screen = screens.nth(i);
    const id = await screen.getAttribute("id");
    await screen.scrollIntoViewIfNeeded();
    await screen.screenshot({ path: join(out, `${id}.png`) });
    console.log(`${id}.png`);
}
await browser.close();
