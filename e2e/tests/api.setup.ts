import fs from "fs";
import path from "path";
import { test as setup, expect } from "@playwright/test";
import { WorkspaceFixture } from "./auth.setup";
import { faker } from "@faker-js/faker";

export const generateAPIKeyName = () => 
    `e2e-${faker.string.numeric(6)}`;

// Ensure auth directory exists
const authDir = path.join(process.cwd(), ".auth");
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Export API token data type
export type APITokenFixture = {
  token: string;
  name: string;
  prefix: string;
};

// Generate API token using authenticated browser context
setup("generate API token", async ({ browser }) => {
  // Define paths
  const apiTokenPath = path.join(authDir, "api-token.json");
  const userAuthFile = path.join(authDir, "user.json");
  
  // Create a new context with the stored authentication
  const context = await browser.newContext({ 
    storageState: userAuthFile 
  });
  const page = await context.newPage();
  
  try {
    // Set longer timeouts for navigation
    page.setDefaultTimeout(5000);
    
    // Load workspace data
    const workspaceData: WorkspaceFixture = JSON.parse(
      await fs.promises.readFile(
        path.join(authDir, "workspace.json"),
        "utf-8"
      )
    );
    
    // Generate a random API key name
    const apiKeyName = generateAPIKeyName();
    
    // Navigate directly to the API page
    await page.goto(`http://localhost:3000/${workspaceData.name}/settings/account/api`);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForLoadState("networkidle");
    
    // Wait for the page content to be properly loaded
    await page.waitForSelector('input[placeholder="Name"]', { timeout: 10000 });
    
    // Fill the name input and create the API key
    await page.locator('input[placeholder="Name"]').fill(apiKeyName);
    await page.getByRole("button", { name: "Create new API key" }).click();
    
    // Wait for the dialog to appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10000 });
    
    // Give a moment for the dialog to fully render
    await page.waitForTimeout(1000);
    
    // Get the API key from the dialog - try multiple selectors
    let apiKey = "";
    
    // Try readonly input first
    const readonlyInput = dialog.locator('input[readonly]');
    if (await readonlyInput.count() > 0) {
      apiKey = await readonlyInput.inputValue();
    }
    
    // If not found, try disabled input
    if (!apiKey) {
      const disabledInput = dialog.locator('input[disabled]');
      if (await disabledInput.count() > 0) {
        apiKey = await disabledInput.inputValue();
      }
    }
    
    // If still not found, try any input in the dialog
    if (!apiKey) {
      const anyInput = dialog.locator('input').first();
      if (await anyInput.count() > 0) {
        apiKey = await anyInput.inputValue();
      }
    }
    
    if (!apiKey) {
      throw new Error("Could not find API key in dialog");
    }
    
    // Save the API key
    const apiTokenData: APITokenFixture = {
      token: apiKey,
      name: apiKeyName,
      prefix: apiKey.split('.')[0] || ''
    };
    
    await fs.promises.writeFile(
      apiTokenPath,
      JSON.stringify(apiTokenData)
    );
    
  } finally {
    await context.close();
  }
}); 