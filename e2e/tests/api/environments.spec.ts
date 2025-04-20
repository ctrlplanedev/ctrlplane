import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

test.describe("Environments API", () => {
  let system: { id: string };

  test.beforeAll(async ({ api, workspace }) => {
    const systemName = faker.string.alphanumeric(10).toLowerCase();
    const response = await api.POST("/v1/systems", {
      body: {
        workspaceId: workspace.id,
        name: systemName,
        slug: systemName,
        description: "Environments API",
      },
    });

    expect(response.response.status).toBe(201);
    expect(response.data?.id).toBeDefined();
    system = { id: response.data!.id };
  });

  test("should create an environment", async ({ api }) => {
    const environmentName = faker.string.alphanumeric(10);
    const environment = await api.POST("/v1/environments", {
      body: {
        name: environmentName,
        systemId: system.id,
      },
    });

    console.log("environment", JSON.stringify(environment, null, 2));
    expect(environment.response.status).toBe(200);
    expect(environment.data?.id).toBeDefined();
    expect(environment.data?.name).toBe(environmentName);
  });
});
