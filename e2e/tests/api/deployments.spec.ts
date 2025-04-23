import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "deployments.spec.yaml");

test.describe("Deployments API", () => {
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

  test("should create a deployment", async ({ api }) => {
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
      },
    });

    expect(deployment.response.status).toBe(201);
    expect(deployment.data?.id).toBeDefined();
    expect(deployment.data?.name).toBe(deploymentName);
    expect(deployment.data?.slug).toBe(deploymentName);
  });

  test("should get a deployment", async ({ api }) => {
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
      },
    });

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    const getDeployment = await api.GET("/v1/deployments/{deploymentId}", {
      params: {
        path: {
          deploymentId,
        },
      },
    });

    expect(getDeployment.response.status).toBe(200);
    expect(getDeployment.data?.id).toBe(deploymentId);
    expect(getDeployment.data?.name).toBe(deploymentName);
    expect(getDeployment.data?.slug).toBe(deploymentName);
  });

  test("should update a deployment's basic fields", async ({ api }) => {
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
      },
    });

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    const newDeploymentName = faker.string.alphanumeric(10);
    const newDescription = faker.lorem.sentence();
    const updateDeployment = await api.PATCH("/v1/deployments/{deploymentId}", {
      params: {
        path: {
          deploymentId,
        },
      },
      body: {
        name: newDeploymentName,
        slug: newDeploymentName,
        description: newDescription,
        retryCount: 1,
        timeout: 1000,
      },
    });

    expect(updateDeployment.response.status).toBe(200);
    expect(updateDeployment.data?.id).toBe(deploymentId);
    expect(updateDeployment.data?.name).toBe(newDeploymentName);
    expect(updateDeployment.data?.description).toBe(newDescription);
    expect(updateDeployment.data?.retryCount).toBe(1);
    expect(updateDeployment.data?.timeout).toBe(1000);
  });

  test("should delete a deployment", async ({ api }) => {
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
      },
    });

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    const deleteDeployment = await api.DELETE(
      "/v1/deployments/{deploymentId}",
      {
        params: {
          path: {
            deploymentId,
          },
        },
      },
    );

    expect(deleteDeployment.response.status).toBe(200);
    expect(deleteDeployment.data?.id).toBe(deploymentId);

    const getDeployment = await api.GET("/v1/deployments/{deploymentId}", {
      params: {
        path: {
          deploymentId,
        },
      },
    });

    expect(getDeployment.data).toBeUndefined();
  });

  test("should match resources to a deployment", async ({ api, page }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
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

    await page.waitForTimeout(10_000);

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    const resources = await api.GET(
      "/v1/deployments/{deploymentId}/resources",
      {
        params: {
          path: {
            deploymentId,
          },
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.resources?.length).toBe(1);
    expect(resources.data?.resources?.[0]?.identifier).toBe(
      importedEntities.resources.find((r) => r.metadata?.env === "qa")
        ?.identifier,
    );
  });

  test("should update a deployment's resource selector and update matched resources", async ({
    api,
    page,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
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

    await page.waitForTimeout(5_000);

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    await api.PATCH("/v1/deployments/{deploymentId}", {
      params: {
        path: {
          deploymentId,
        },
      },
      body: {
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

    await page.waitForTimeout(10_000);

    const resources = await api.GET(
      "/v1/deployments/{deploymentId}/resources",
      {
        params: {
          path: {
            deploymentId,
          },
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.resources?.length).toBe(1);
    expect(resources.data?.resources?.[0]?.identifier).toBe(
      importedEntities.resources.find((r) => r.metadata?.env === "prod")
        ?.identifier,
    );
  });

  test("should not match deleted resources", async ({
    api,
    page,
    workspace,
  }) => {
    for (const resource of importedEntities.resources)
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

    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = faker.string.alphanumeric(10);
    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
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

    await page.waitForTimeout(10_000);

    const deploymentId = deployment.data?.id;
    expect(deploymentId).toBeDefined();
    if (!deploymentId) throw new Error("Deployment ID is undefined");

    const resources = await api.GET(
      "/v1/deployments/{deploymentId}/resources",
      {
        params: {
          path: {
            deploymentId,
          },
        },
      },
    );

    expect(resources.response.status).toBe(200);
    expect(resources.data?.resources?.length).toBe(0);
  });
});
