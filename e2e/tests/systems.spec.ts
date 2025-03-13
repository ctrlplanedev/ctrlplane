import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "./fixtures";

test.describe("Systems page", () => {
  test.beforeEach(async ({ page, workspace }) => {
    // Navigate to systems page before each test
    await page.goto(`/${workspace.name}/systems`);
  });

  test("can create a new system", async ({ page }) => {
    // Click create system button
    await page.waitForSelector('button:has-text("New System")', {
      timeout: 10000,
    });
    await page.getByRole("button", { name: /new system/i }).click();

    // Generate random system name
    const systemName =
      `test-system-${faker.string.alphanumeric(6)}`.toLowerCase();

    // Fill out system form
    await page.getByLabel("Name").fill(systemName);
    await page.getByLabel("Description").fill("This is a test system");

    // Submit form
    await page.getByRole("button", { name: "Create" }).click();

    // Verify success message
    await expect(page.getByText("System created successfully")).toBeVisible();

    // Verify new system appears in list
    await expect(page.getByRole("link", { name: systemName })).toBeVisible();
  });
});
