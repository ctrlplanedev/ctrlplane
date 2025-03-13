import { expect } from "@playwright/test";

import { test } from "./fixtures";

test("loads systems page", async ({ page, workspace }) => {
  // Navigate to systems page using workspace name from fixture
  await page.goto(`/${workspace.name}/systems`);

  // Verify page loaded
  await expect(page).toHaveURL(`/${workspace.name}/systems`);
});
