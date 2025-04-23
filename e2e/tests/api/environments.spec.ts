import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "environments.spec.yaml");

test.describe("Environments API", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
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

    expect(environmentResponse.response.status).toBe(200);
    expect(environmentResponse.data?.id).toBeDefined();

    const environment = environmentResponse.data!;

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

  test("should update environment selector and match new resources", async ({ api, page }) => {
    // First create an environment with a selector for QA resources
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

    expect(environmentResponse.response.status).toBe(200);
    expect(environmentResponse.data?.id).toBeDefined();

    const environment = environmentResponse.data!;

    // Verify initial resources (should only be the QA resource)
    await page.waitForTimeout(10_000);

    const initialResourcesResponse = await api.GET(
      "/v1/environments/{environmentId}/resources",
      { params: { path: { environmentId: environment.id } } },
    );

    expect(initialResourcesResponse.response.status).toBe(200);
    expect(initialResourcesResponse.data?.resources?.length).toBe(1);
    expect(initialResourcesResponse.data?.resources?.[0]?.identifier).toBe(
      importedEntities.resources.find((r) => r.metadata?.env === "qa")
        ?.identifier,
    );

    // Now update the environment to select prod resources instead
    const updateResponse = await api.POST("/v1/environments", {
      body: {
        id: environment.id,
        name: environment.name,
        systemId: importedEntities.system.id,
        resourceSelector: {
          type: "comparison",
          operator: "and",
          conditions: [
            {
              type: "metadata",
              operator: "equals",
              key: "env",
              value: "prod",
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

    expect(updateResponse.response.status).toBe(200);
    expect(updateResponse.data?.id).toBeDefined();

    // Wait longer for selector compute to complete (30 seconds)
    await page.waitForTimeout(30_000);

    // Check if the resources have been updated
    const updatedResourcesResponse = await api.GET(
      "/v1/environments/{environmentId}/resources",
      { params: { path: { environmentId: environment.id } } },
    );

    expect(updatedResourcesResponse.response.status).toBe(200);
    expect(updatedResourcesResponse.data?.resources?.length).toBe(1);
    expect(updatedResourcesResponse.data?.resources?.[0]?.identifier).toBe(
      importedEntities.resources.find((r) => r.metadata?.env === "prod")
        ?.identifier,
    );
  });

  test("should match not match deleted resources", async ({
    api,
    page,
    workspace,
  }) => {
    for (const resource of importedEntities.resources) {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
        {
          params: {
            path: {
              workspaceId: workspace.id,
              identifier: resource.identifier,
            },
          },
        },
      );
    }

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
    expect(resourcesResponse.data?.resources?.length).toBe(0);
  });
});
