import { expect, test } from "./fixtures";

test("a fresh visit only talks to the app's own server", async ({
    page,
    externalHosts,
}) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Give lazy work (map tiles, play-area lookup, fonts) time to start.
    await page.waitForTimeout(3000);

    expect([...externalHosts]).toEqual([]);
});
