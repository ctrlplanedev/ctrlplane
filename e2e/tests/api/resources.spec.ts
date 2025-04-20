import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Resource API", () => {
  test("create a resource", async ({ page, api, workspace }) => {
    const resourceName = faker.string.alphanumeric(10);

    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        resources: [
          {
            name: resourceName,
            kind: "ResourceAPI",
            identifier: resourceName,
            version: "test-version/v1",
            config: { "e2e-test": true } as any,
            metadata: { "e2e-test": "true" },
          },
        ],
      },
    });

    expect(resource.response.status).toBe(200);
  });
});
