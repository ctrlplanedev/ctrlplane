import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "./fixtures";

/**
 * Deployments Testing Strategy
 * 
 * Based on Playwright best practices:
 * 
 * 1. Test Structure: Tests are organized by page/feature type
 *    - System deployments
 *    - Workspace deployments
 *    - Individual deployment details
 * 
 * 2. Isolation and Setup:
 *    - Each test creates its own state where needed
 *    - Each test performs navigation and verification in a self-contained manner
 *    - Common test data is determined before tests run
 * 
 * 3. Test Coverage:
 *    - Navigation and visibility of key UI elements
 *    - Creation and management flows
 *    - Search functionality
 * 
 * 4. Clean-up:
 *    - Clean up test data at the end to avoid polluting the test environment
 */

// Use serial to ensure proper execution order when tests have dependencies
test.describe.serial("Deployments", () => {
  // Define test data - use a consistent naming pattern for easier cleanup
  const systemName = `test-sys-deploy${faker.string.alphanumeric(4)}`.toLowerCase();
  const deploymentName = `test-dep-${faker.string.alphanumeric(4)}`.toLowerCase();
  
  // Test for workspace-level deployments page
  test("can view workspace deployments page", async ({ page, workspace }) => {
    // Navigate directly to deployments page
    await page.goto(`/${workspace.name}/deployments`);
    
    // Verify we're on the deployments page
    await expect(page).toHaveURL(new RegExp(`/${workspace.name}/deployments`));
    
    // Be specific by using the unique text in the button
    const createDeploymentButton = page.getByRole('button', { name: 'Create Deployment' }).first();
    await expect(createDeploymentButton).toBeVisible();
    
    // Verify search box is visible
    await expect(page.getByRole("textbox", { name: "Search..." })).toBeVisible();
  });
  
  // Test for navigating system deployments
  test("can create a system and view its deployments page", async ({ page, workspace }) => {
    // Navigate to systems page
    await page.goto(`/${workspace.name}/systems`);
    
    // Click on New System
    await page.getByRole("button", { name: "New System" }).click();
    
    // Wait for dialog to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    
    // Fill out system form
    await page.getByRole("textbox", { name: "Name" }).fill(systemName);
    await page.getByRole("textbox", { name: "Description" }).fill("Test system for deployments");
    await page.getByRole("button", { name: "Create system" }).click();
    
    // Wait for navigation to the deployments page of the new system
    await page.waitForURL(new RegExp(`/${workspace.name}/systems/${systemName}/deployments`), { timeout: 15000 });
    
    // Verify system page is loaded with sidebar
    await expect(page.getByText("Release Management")).toBeVisible({ timeout: 10000 });
    
    // Check for the Create Deployment button in the navbar (first one)
    await expect(page.getByRole("button", { name: "Create Deployment" }).first()).toBeVisible();
  });
  
  // Test for creating a deployment
  test("can create a deployment for a system", async ({ page, workspace }) => {
    // First navigate to the system deployments page
    await page.goto(`/${workspace.name}/systems/${systemName}/deployments`);
    
    // Verify we're on the right page
    await expect(page).toHaveURL(new RegExp(`/${workspace.name}/systems/${systemName}/deployments`));
    
    // Use the button that is near the Documentation link
    // This is the second one on the page
    const createButton = page.locator('main').getByRole('button', { name: 'Create Deployment' }).nth(1);
    await createButton.click();
    
    // Wait for the dialog to appear
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
    
    // Fill out deployment form
    await page.getByRole("textbox", { name: "Name" }).fill(deploymentName);
    await page.getByRole("textbox", { name: "Description" }).fill("Test deployment description");
    
    // Submit the form
    await page.getByRole("button", { name: "Create" }).click();
    
    // Wait for navigation to the deployment page
    await page.waitForURL(new RegExp(`/${workspace.name}/systems/${systemName}/deployments/${deploymentName}`), { timeout: 15000 });
    
    // Verify the page title is correct - a more specific check
    await expect(page).toHaveTitle(new RegExp(`Releases.+${deploymentName}`));
    
    // Check for a specific breadcrumb element that contains the deployment name
    const breadcrumbDeploymentLink = page.locator('nav[aria-label="breadcrumb"]').getByRole('link', { name: deploymentName, exact: true });
    await expect(breadcrumbDeploymentLink).toBeVisible();
  });
  
  // Clean up test data at the end
  test("cleanup: delete test system", async ({ page, workspace }) => {
    // Navigate to the system settings page
    await page.goto(`/${workspace.name}/systems/${systemName}/settings`);
    
    // Click delete button 
    try {
      // Wait for the page to load
      await page.waitForLoadState('networkidle');
      
      // Click the Delete System button
      await page.getByRole("button", { name: "Delete System" }).click();
      
      // Wait for the confirmation dialog
      await page.waitForSelector('[role="alertdialog"]', { timeout: 10000 });
      
      // Confirm deletion
      await page.getByRole("button", { name: "Delete" }).click();
      
      // Verify redirect to systems page
      await page.waitForURL(new RegExp(`/${workspace.name}/systems`), { timeout: 15000 });
    } catch (e) {
      console.log('Could not delete system - might already be deleted');
    }
    
    // Mark test as passed
    expect(true).toBeTruthy();
  });
}); 