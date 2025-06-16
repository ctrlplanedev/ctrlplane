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
  slug: string;
  apiKey: string;
  secondaryApiKey: string;
  id: string;
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

const getWorkspaceId = async (page: Page, workspaceName: string) => {
  await page.goto(`/${workspaceName}/settings/workspace/general`);
  const workspaceId = await page.getByTestId("workspace-id").inputValue();
  return workspaceId;
};

const createApiKey = async (page: Page, workspaceName: string) => {
  await page.goto(`/${workspaceName}/settings/account/api`);
  const keyName = faker.string.alphanumeric(10);
  await page.getByTestId("key-name").fill(keyName);
  await page.getByTestId("create-key").click();
  const apiKey = await page.getByTestId("key-value").inputValue();
  await page.getByTestId("close-key-dialog").click();
  return apiKey;
};

const copyInviteLink = async (page: Page, workspaceName: string) => {
  await page.goto(`/${workspaceName}/settings/workspace/members`);
  await page.getByTestId("add-member-button").click();
  await page.getByTestId("copy-invite-link").click();
  const inviteLink = await page.getByTestId("invite-link").inputValue();
  const inviteLinkTokens = inviteLink.split("/");
  const inviteToken = inviteLinkTokens[inviteLinkTokens.length - 1]!;
  await page.getByTestId("close-invite-dialog").click();
  return inviteToken;
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

const signUpWithInviteLink = async (page: Page, inviteToken: string) => {
  await page.goto(`/join/${inviteToken}`);
  const name = generateRandomUsername();
  const email = generateRandomEmail(name);
  const password = "TestPassword123!";

  await page.getByTestId("sign-up-redirect-link").click();
  await page.getByTestId("name").fill(name);
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill(password);
  await page.getByTestId("submit").click();
  await page.getByTestId("accept-invite-button").click();
};

const signOut = async (page: Page) => {
  await page.getByTestId("user-avatar").click();
  await page.getByTestId("logout-button").click();
  await expect(page).toHaveURL("/login");
};

setup("authenticate", async ({ page }) => {
  if (fs.existsSync(stateFile) && fs.existsSync(workspaceFile)) return;

  await signUp(page);
  await page.context().storageState({ path: path.join(stateDir, "user.json") });

  const workspaceName = await createWorkspace(page);
  const workspaceId = await getWorkspaceId(page, workspaceName);
  const apiKey = await createApiKey(page, workspaceName);
  const inviteLink = await copyInviteLink(page, workspaceName);
  await signOut(page);
  await signUpWithInviteLink(page, inviteLink);
  const secondaryApiKey = await createApiKey(page, workspaceName);

  const workspaceData: WorkspaceFixture = {
    name: workspaceName,
    apiKey,
    secondaryApiKey,
    slug: workspaceName,
    id: workspaceId,
  };
  await fs.promises.writeFile(workspaceFile, JSON.stringify(workspaceData));
});
