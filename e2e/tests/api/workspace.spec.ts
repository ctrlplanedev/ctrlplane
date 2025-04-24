import path from "path";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "workspace.spec.yaml");

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

  test("should fetch a workspace by slug", async ({ api, workspace }) => {
    const workspaceResponse = await api.GET(
      "/v1/workspaces/slug/{workspaceSlug}",
      {
        params: {
          path: { workspaceSlug: workspace.slug },
        },
      },
    );

    expect(workspaceResponse.response.status).toBe(200);
    expect(workspaceResponse.data?.id).toBe(workspace.id);
  });
});
