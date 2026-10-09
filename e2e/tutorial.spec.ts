import { expect, test } from "./fixtures";

test("the tutorial can be clicked through to the end", async ({
    page,
    externalHosts,
    pageErrors,
}) => {
    void externalHosts; // keep the outside world blocked
    await page.goto("/");

    const counter = page.getByText(/^\d+ of \d+$/);
    await expect(counter).toBeVisible();
    const total = Number((await counter.innerText()).split(" of ")[1]);
    expect(total).toBeLessThanOrEqual(15);

    for (let step = 2; step <= total; step++) {
        // The dialog moves next to the highlighted element shortly after each
        // step appears; wait until it's in place before clicking.
        await page.locator(`[data-positioned-step="${step - 2}"]`).waitFor();
        await page.getByRole("button", { name: "Next" }).click();
        await expect(counter).toHaveText(`${step} of ${total}`);
    }

    await page.getByRole("button", { name: /Get Started/ }).click();
    await expect(counter).toBeHidden();
    expect(pageErrors).toEqual([]);
});
