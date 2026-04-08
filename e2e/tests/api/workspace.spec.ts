import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Workspace API", () => {
  test("should fetch a workspace by ID", async ({ api, workspace }) => {
    const workspaceResponse = await api.GET("/v1/workspaces/{workspaceId}", {
      params: {
        path: { workspaceId: workspace.id },
      },
    });

    expect(workspaceResponse.response.status).toBe(200);
    expect(workspaceResponse.data?.id).toBe(workspace.id);
  });
});
