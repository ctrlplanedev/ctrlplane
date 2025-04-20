import fs from "fs";
import path from "path";
import { expect, test as setup } from "@playwright/test";
import { faker } from "@faker-js/faker";

const generateRandomUsername = () =>
  `testuser_${faker.string.alphanumeric(10)}`.toLocaleLowerCase();
const generateRandomEmail = (username: string) =>
  `${username}@example.com`.toLocaleLowerCase();
export const generateRandomWorkspaceName = () =>
  `workspace_${faker.string.alphanumeric(8)}`.toLocaleLowerCase();

// Ensure auth directory exists
const authDir = path.join(process.cwd(), ".auth");
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Export workspace data type
export type WorkspaceFixture = {
  name: string;
};

setup("authenticate", async ({ page }) => {
  // Generate random credentials
  const name = generateRandomUsername();
  const email = generateRandomEmail(name);
  const password = "TestPassword123!";

  // Navigate to the registration page
  await page.goto("/sign-up");
  
  // Take a snapshot to examine the page structure
  await page.evaluate(() => {
    const mcpBrowserSnapshot = (window as any).mcpBrowserSnapshot;
    if (mcpBrowserSnapshot) mcpBrowserSnapshot();
  });
  
  // Find and fill in the name field
  const nameField = await page.waitForSelector('input[placeholder="John Doe"]');
  await nameField.fill(name);
  
  // Find and fill in the email field
  const emailField = await page.waitForSelector('input[placeholder="you@company.com"]');
  await emailField.fill(email);
  
  // Find and fill in the password field
  const passwordField = await page.waitForSelector('input[type="password"]');
  await passwordField.fill(password);
  
  // Find and click the create account button
  const createAccountButton = await page.waitForSelector('button[type="submit"]');
  await createAccountButton.click();
  await page.waitForURL("/workspaces/create", { timeout: 10000 });

  // Should be redirected to workspace creation
  await expect(page).toHaveURL("/workspaces/create", { timeout: 10000 });

  // Take another snapshot at workspace creation page
  await page.evaluate(() => {
    const mcpBrowserSnapshot = (window as any).mcpBrowserSnapshot;
    if (mcpBrowserSnapshot) mcpBrowserSnapshot();
  });

  // Save signed-in state
  await page.context().storageState({ path: path.join(authDir, "user.json") });

  const workspaceName = generateRandomWorkspaceName();
  
  // Wait for heading to be visible to ensure the page is loaded
  await page.waitForSelector('h1:has-text("Create a new workspace")', { timeout: 10000 });
  
  // Create initial workspace with role-based selector
  const nameInput = await page.getByRole('textbox').first();
  await nameInput.fill(workspaceName);
  
  // Find and click the create workspace button
  const createButton = await page.getByRole('button', { name: /create workspace/i }).first();
  await createButton.click();
  await page.waitForURL(new RegExp(`/${workspaceName.toLowerCase()}`), { timeout: 15000 });

  // Wait for successful navigation to the workspace page
  await expect(page).toHaveURL(new RegExp(`/${workspaceName.toLowerCase()}`), { timeout: 15000 });

  // Store the workspace information
  const workspaceData: WorkspaceFixture = {
    name: workspaceName,
  };

  // Save workspace data to a file
  await fs.promises.writeFile(
    path.join(authDir, "workspace.json"),
    JSON.stringify(workspaceData),
  );
});
