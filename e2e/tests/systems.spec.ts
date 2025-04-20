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

    // Create system
    await page.waitForSelector('button:has-text("New System")', {
      timeout: 10000,
    });
    await page.getByRole("button", { name: "New System" }).click();

    // Fill out system form in the dialog
    await page.getByRole("textbox", { name: "Name" }).fill(systemName);
    await page.getByRole("textbox", { name: "Description" }).fill("This is a test system");
    
    // Submit form by clicking Create system button
    await page.getByRole("button", { name: "Create system" }).click();

    // Wait for navigation and for the deployments page to load
    await page.waitForURL(
      new RegExp(`/${workspace.name}/systems/${systemName.toLowerCase()}`),
      { timeout: 15000 }
    );
    
    // Wait for the sidebar to appear, which indicates the system page has loaded
    await page.waitForSelector('text="Release Management"', { timeout: 10000 });
  });

  test("can navigate to created system", async ({ page, workspace }) => {
    // Verify we're on a page for the system (the URL pattern can be more flexible)
    await expect(page).toHaveURL(
      new RegExp(`/${workspace.name}/systems/${systemName.toLowerCase()}`)
    );
    
    // Verify the system name appears in the UI (in the breadcrumb)
    await expect(page.getByRole("link", { name: systemName })).toBeVisible({ timeout: 5000 });
  });

  test("can edit system details", async ({ page, workspace }) => {
    // Navigate directly to the settings page instead of clicking the link
    await page.goto(`/${workspace.name}/systems/${systemName}/settings`);
    
    // Wait for the settings page to load completely
    await page.waitForLoadState('networkidle');
    
    // Wait for the Description field to be visible
    await page.waitForSelector('text="Description"', { timeout: 10000 });

    // Update the description field
    const newDescription = "Updated system description";
    await page.getByRole("textbox", { name: "Description" }).fill(newDescription);
    
    // Save changes - the button appears as disabled but becomes enabled after edits
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled({ timeout: 5000 });
    await page.getByRole("button", { name: "Save" }).click();
    
    // Verify the save button becomes disabled again after saving
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled({ timeout: 10000 });
  });

  test("can delete system", async ({ page, workspace }) => {
    // Navigate directly to the settings page instead of clicking the link
    await page.goto(`/${workspace.name}/systems/${systemName}/settings`);
    
    // Wait for settings page to load
    await page.waitForSelector('button:has-text("Delete System")', { timeout: 10000 });

    // Click delete button
    await page.getByRole("button", { name: "Delete System" }).click();
    
    // Wait for the delete confirmation dialog
    await page.waitForSelector('button:has-text("Delete")', { timeout: 10000 });
    
    // Click the Delete button in the dialog
    await page.getByRole("button", { name: "Delete" }).click();

    // Verify redirected to systems page
    await page.waitForURL(new RegExp(`/${workspace.name}/systems$`), { timeout: 10000 });
  });

  test("displays system details correctly", async ({ page, workspace }) => {
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    
    // The system name should be visible in the breadcrumb navigation
    await expect(page.getByRole("link", { name: systemName })).toBeVisible({ timeout: 5000 });
    
    // Verify system navigation sidebar exists
    await expect(page.getByText("Release Management")).toBeVisible();
    
    // Use more specific selectors by including the URL path
    const systemPath = `/${workspace.name}/systems/${systemName}`;
    await expect(page.locator(`a[href="${systemPath}/deployments"]`)).toBeVisible();
    await expect(page.locator(`a[href="${systemPath}/environments"]`)).toBeVisible();
    await expect(page.locator(`a[href="${systemPath}/variables"]`)).toBeVisible();
  });

  test("can search for system", async ({ page, workspace }) => {
    // Navigate back to systems list
    await page.goto(`/${workspace.name}/systems`);

    // Find the system in the list
    await expect(page.getByRole("link", { name: systemName })).toBeVisible({ timeout: 5000 });
    
    // Use the system-specific search box, not the global search
    await page.getByRole("textbox", { name: "Search systems and deployments..." }).fill(systemName);
    
    // Verify the system is still visible after search
    await expect(page.getByRole("link", { name: systemName })).toBeVisible({ timeout: 5000 });
    
    // Search for non-existent system
    await page.getByRole("textbox", { name: "Search systems and deployments..." }).fill("nonexistent-xyz");
    
    // Verify no results found (the system should no longer be visible)
    await expect(page.getByRole("link", { name: systemName })).not.toBeVisible({ timeout: 5000 });
  });
});
