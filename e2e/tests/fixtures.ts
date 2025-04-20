import fs from "fs";
import path from "path";
import { test as base } from "@playwright/test";
import { WorkspaceFixture } from "./auth.setup";
import { APITokenFixture } from "./api.setup"; // Import the API token fixture type

// Extend the base test with our custom fixtures
export const test = base.extend<{
  apiToken: APITokenFixture;
  workspace: WorkspaceFixture;
}>({
  // Load API token from file
  apiToken: async ({}, use) => {
    const apiTokenPath = path.join(process.cwd(), ".auth", "api-token.json");
    
    // Read the API token file, matching the workspace approach
    const apiTokenData: APITokenFixture = JSON.parse(
      await fs.promises.readFile(apiTokenPath, "utf-8"),
    );

    // Use the token data in tests
    await use(apiTokenData);
  },
  
  // Load workspace data from file
  workspace: async ({}, use) => {
    const workspaceData: WorkspaceFixture = JSON.parse(
      await fs.promises.readFile(
        path.join(process.cwd(), ".auth", "workspace.json"),
        "utf-8",
      ),
    );

    // Use the workspace in tests
    await use(workspaceData);
  }
});
