import { test, expect } from "@playwright/test";

test("locations render and a ride reaches a driver through the real services", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("combobox").first().selectOption({ label: "My Home" });
  await page.getByRole("combobox").nth(1).selectOption({ label: "Rachel's Floral Designs" });
  await page.getByRole("button", { name: "Request Ride", exact: true }).click();
  await page.getByRole("button", { name: "Show Logs", exact: true }).click();
  await expect(page.getByRole("button", { name: /Request ID:.*My Home.*Rachel's Floral Designs/ })).toBeVisible();
  await expect(page.getByText("Resolving routes", { exact: true })).toBeVisible();
  await expect(page.locator("//div[p[2][contains(text(), 'driver')]]/p[4]").last()).toHaveText(/T7\d{5}C/);
  await expect(page.getByText(/The driver .* will arrive in/)).toBeVisible();
  if (process.env.HOTROD_EXPECT_SANDBOX) {
    await expect(page.getByText(`(${process.env.HOTROD_EXPECT_SANDBOX})`, { exact: true }).first()).toBeVisible();
  }
  expect(errors, "uncaught browser errors").toEqual([]);
});
