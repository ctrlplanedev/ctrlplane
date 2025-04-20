import fs from "fs";
import path from "path";
import { faker } from "@faker-js/faker";
import { expect, Page, test as setup } from "@playwright/test";
import ms from "ms";

const generateRandomUsername = () =>
  `testuser_${faker.string.alphanumeric(10)}`.toLocaleLowerCase();
const generateRandomEmail = (username: string) =>
  `${username}@example.com`.toLocaleLowerCase();
export const generateRandomWorkspaceName = () =>
  `workspace_${faker.string.alphanumeric(8)}`.toLocaleLowerCase();

// Export workspace data type
export type WorkspaceFixture = {
  name: string;
  apiKey: string;
};

// Ensure auth directory exists
const stateDir = path.join(process.cwd(), ".state");
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

const stateFile = path.join(stateDir, "user.json");
export const workspaceFile = path.join(stateDir, "workspace.json");

const createWorkspace = async (page: Page) => {
  await page.goto("/workspaces/create");
  const workspaceName = generateRandomWorkspaceName();
  await page.getByTestId("name").fill(workspaceName);
  await page.getByTestId("submit").click();
  return workspaceName;
};

const createApiKey = async (page: Page, workspaceName: string) => {
  await page.goto(`/${workspaceName}/settings/account/api`);
  const keyName = faker.string.alphanumeric(10);
  await page.getByTestId("key-name").fill(keyName);
  await page.getByTestId("create-key").click();
  const apiKey = await page.getByTestId("key-value").inputValue();
  return apiKey;
};

const signUp = async (page: Page) => {
  // Generate random credentials
  const name = generateRandomUsername();
  const email = generateRandomEmail(name);
  const password = "TestPassword123!";

  // Navigate to the registration page
  await page.goto("/sign-up");

  // Fill in registration form using more resilient selectors
  await page.getByTestId("name").fill(name);
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill(password);
  await page.getByTestId("submit").click();

  // Should be redirected to workspace creation
  await expect(page).toHaveURL("/workspaces/create", { timeout: ms("1m") });
};

setup("authenticate", async ({ page }) => {
  if (fs.existsSync(stateFile) && fs.existsSync(workspaceFile)) {
    return;
  }

  await signUp(page);
  await page.context().storageState({ path: path.join(stateDir, "user.json") });

  const workspaceName = await createWorkspace(page);
  const apiKey = await createApiKey(page, workspaceName);

  const workspaceData: WorkspaceFixture = { name: workspaceName, apiKey };
  await fs.promises.writeFile(workspaceFile, JSON.stringify(workspaceData));
});
