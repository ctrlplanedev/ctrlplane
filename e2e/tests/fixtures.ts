import fs from "fs";
import path from "path";
import { test as base } from "@playwright/test";

import type { WorkspaceFixture } from "./auth.setup";

// Extend the test type to include our workspace fixture
export const test = base.extend<{ workspace: WorkspaceFixture }>({
  workspace: async ({}, use) => {
    const workspaceData: WorkspaceFixture = JSON.parse(
      await fs.promises.readFile(
        path.join(process.cwd(), ".auth", "workspace.json"),
        "utf-8",
      ),
    );

    await use(workspaceData);
  },
});
