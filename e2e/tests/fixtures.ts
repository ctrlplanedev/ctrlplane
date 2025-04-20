import fs from "fs";
import path from "path";
import { test as base } from "@playwright/test";

import type { WorkspaceFixture } from "./auth.setup";
import { createClient } from "../api";

const workspaceFile = path.join(process.cwd(), ".state", "workspace.json");

// Extend the test type to include our workspace fixture
export const test = base.extend<{
  workspace: WorkspaceFixture;
  api: ReturnType<typeof createClient>;
}>({
  workspace: async ({}, use) => {
    const workspaceData: WorkspaceFixture = JSON.parse(
      await fs.promises.readFile(workspaceFile, "utf-8"),
    );

    await use(workspaceData);
  },
  api: async ({ workspace: { apiKey }, baseURL }, use) => {
    const api = createClient({ apiKey, baseUrl: baseURL });
    await use(api);
  },
});
