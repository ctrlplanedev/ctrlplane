import fs from "fs";
import path from "path";
import { expect, test as setup } from "@playwright/test";
import { nanoid } from "nanoid";

const generateRandomUsername = () =>
  `testuser_${nanoid(10)}`.toLocaleLowerCase();
const generateRandomEmail = (username: string) =>
  `${username}@example.com`.toLocaleLowerCase();
export const generateRandomWorkspaceName = () =>
  `workspace_${nanoid(8)}`.toLocaleLowerCase();

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

  // Fill in registration form using more resilient selectors
  await page.getByRole("textbox", { name: /name/i }).fill(name);
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByRole("textbox", { name: /password/i }).fill(password);
  await page.getByRole("button", { name: /continue/i }).click();

  // Should be redirected to workspace creation
  await expect(page).toHaveURL("/workspaces/create", { timeout: 10000 });

  // Save signed-in state
  await page.context().storageState({ path: path.join(authDir, "user.json") });
});

// Create a workspace fixture
setup("create workspace", async ({ page }) => {
  const workspaceName = generateRandomWorkspaceName();

  // Navigate to workspace creation if not already there
  const currentUrl = page.url();
  if (!currentUrl.includes("/workspaces/create")) {
    await page.goto("/workspaces/create");
  }

  // Create initial workspace
  await page.getByRole("textbox", { name: /name/i }).fill(workspaceName);
  await page.getByRole("button", { name: /create/i }).click();

  // Wait for workspace creation and redirect
  await expect(page).toHaveURL(new RegExp(`/${workspaceName}.*`), {
    timeout: 10000,
  });

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
