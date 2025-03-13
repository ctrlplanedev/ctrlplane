import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "./fixtures";

test.describe("Deployment Creation", () => {
  test("can create a new deployment", async ({ page, workspace }) => {
    // Navigate to deployments page
    await page.goto(`/${workspace.name}/deployments`);

    // Click create deployment button
    await page.getByRole("button", { name: /create/i }).click();

    // Fill in deployment details
    const deploymentName =
      `test-deployment-${faker.string.alphanumeric(6)}`.toLowerCase();
    await page.getByRole("textbox", { name: /name/i }).fill(deploymentName);

    // Select deployment type (assuming there's a dropdown)
    await page.getByRole("combobox", { name: /type/i }).click();
    await page.getByRole("option", { name: /standard/i }).click();

    // Submit the form
    await page.getByRole("button", { name: /create|deploy/i }).click();

    // Verify deployment was created
    await expect(page).toHaveURL(
      new RegExp(`/${workspace.name}/deployments/${deploymentName}`),
    );
    await expect(page.getByText(deploymentName)).toBeVisible();
  });

  test("shows validation errors for invalid deployment names", async ({
    page,
    workspace,
  }) => {
    // Navigate to deployments page
    await page.goto(`/${workspace.name}/deployments`);

    // Click create deployment button
    await page.getByRole("button", { name: /create/i }).click();

    // Try to submit with invalid name
    const invalidName = "!@#$%";
    await page.getByRole("textbox", { name: /name/i }).fill(invalidName);
    await page.getByRole("button", { name: /create|deploy/i }).click();

    // Verify error message
    await expect(page.getByText(/invalid deployment name/i)).toBeVisible();
  });

  test("can cancel deployment creation", async ({ page, workspace }) => {
    // Navigate to deployments page
    await page.goto(`/${workspace.name}/deployments`);

    // Click create deployment button
    await page.getByRole("button", { name: /create/i }).click();

    // Fill in some details
    const deploymentName =
      `test-deployment-${faker.string.alphanumeric(6)}`.toLowerCase();
    await page.getByRole("textbox", { name: /name/i }).fill(deploymentName);

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Verify we're back on the deployments list page
    await expect(page).toHaveURL(`/${workspace.name}/deployments`);
    // Verify the deployment wasn't created
    await expect(page.getByText(deploymentName)).not.toBeVisible();
  });
});
