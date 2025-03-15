import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "./fixtures";

test.describe("Systems page", () => {
  let systemName: string;

  test.beforeEach(async ({ page, workspace }) => {
    // Generate random system name once
    systemName = `test-system-${faker.string.alphanumeric(6)}`.toLowerCase();

    // Navigate to systems page
    await page.goto(`/${workspace.name}/systems`);

    // Create system if it doesn't exist
    await page.waitForSelector('button:has-text("New System")', {
      timeout: 10000,
    });
    await page.getByRole("button", { name: /new system/i }).click();

    // Fill out system form
    await page.getByLabel("Name").fill(systemName);
    await page.getByLabel("Description").fill("This is a test system");

    // Submit form
    await page.getByRole("button", { name: "Create" }).click();

    // Verify system was created
    await expect(page).toHaveURL(new RegExp(`systems/${systemName}`));
  });

  test("can navigate to created system", async ({ page }) => {
    // Verify we can access the created system
    await expect(page).toHaveURL(new RegExp(`systems/${systemName}`));
  });

  test("can edit system details", async ({ page }) => {
    // Navigate to system settings
    await page.getByRole("button", { name: /settings/i }).click();

    const newDescription = "Updated system description";
    await page.getByLabel("Description").fill(newDescription);
    await page.getByRole("button", { name: /save/i }).click();

    // Verify changes were saved
    await expect(page.getByText(newDescription)).toBeVisible();
  });

  test("can delete system", async ({ page }) => {
    // Navigate to system settings
    await page.getByRole("button", { name: /settings/i }).click();

    // Click delete button and confirm
    await page.getByRole("button", { name: /delete system/i }).click();
    await page.getByRole("button", { name: /confirm/i }).click();

    // Verify redirected to systems page
    await expect(page).toHaveURL(/\/systems$/);

    // Verify system is no longer listed
    await expect(page.getByText(systemName)).not.toBeVisible();
  });

  test("displays system details correctly", async ({ page }) => {
    // Verify system name is displayed somewhere on the page
    await expect(page.getByText(systemName, { exact: true })).toBeVisible({
      timeout: 1000,
    });

    // Verify description is displayed
    // await expect(page.getByText("This is a test system")).toBeVisible();

    // Verify common UI elements
    await expect(
      page.getByRole("list").getByRole("link", { name: /settings/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("list").getByRole("link", { name: /deployments/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("list").getByRole("link", { name: /environments/i }),
    ).toBeVisible();
  });

  test("can search for system", async ({ page, workspace }) => {
    // Navigate back to systems list
    await page.goto(`/${workspace.name}/systems`);

    // Search for the system
    await page.getByRole("searchbox").fill(systemName);

    // Verify system appears in search results
    await expect(page.getByText(systemName)).toBeVisible();

    // Search for non-existent system
    await page.getByRole("searchbox").fill("nonexistent-system");

    // Verify no results found
    await expect(page.getByText("No systems found")).toBeVisible();
  });
});
