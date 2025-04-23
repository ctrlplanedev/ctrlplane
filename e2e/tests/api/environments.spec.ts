import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

test.describe("Environments API", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    const yamlPath = path.join(__dirname, "environments.spec.yaml");
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("should create an environment", async ({ api }) => {
    const environmentName = faker.string.alphanumeric(10);
    const environment = await api.POST("/v1/environments", {
      body: {
        name: environmentName,
        systemId: importedEntities.system.id,
      },
    });

    expect(environment.response.status).toBe(200);
    expect(environment.data?.id).toBeDefined();
    expect(environment.data?.name).toBe(environmentName);
  });

  test("should match resources to new environment", async ({ api, page }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const environmentResponse = await api.POST("/v1/environments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: importedEntities.system.id,
        resourceSelector: {
          type: "comparison",
          operator: "and",
          conditions: [
            {
              type: "metadata",
              operator: "equals",
              key: "env",
              value: "qa",
            },
            {
              type: "identifier",
              operator: "starts-with",
              value: systemPrefix,
            },
          ],
        },
      },
    });

    if (
      environmentResponse.response.status !== 200 ||
      environmentResponse.data == null
    )
      throw new Error("Failed to create environment");

    const environment = environmentResponse.data;

    await page.waitForTimeout(10_000);

    const resourcesResponse = await api.GET(
      "/v1/environments/{environmentId}/resources",
      { params: { path: { environmentId: environment.id } } },
    );

    expect(resourcesResponse.response.status).toBe(200);
    expect(resourcesResponse.data?.resources?.length).toBe(1);
    expect(resourcesResponse.data?.resources?.[0]?.identifier).toBe(
      importedEntities.resources.find((r) => r.metadata?.env === "qa")
        ?.identifier,
    );
  });
});
