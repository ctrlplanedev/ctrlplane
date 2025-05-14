import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resources.spec.yaml");

test.describe("Resource API", () => {
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

  test("create a resource", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName1 = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName1,
        kind: "ResourceAPI",
        identifier: resourceName1,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    expect(resource.response.status).toBe(200);
    expect(resource.data?.id).toBeDefined();
    expect(resource.error).toBeUndefined();
    expect(resource.data?.workspaceId).toBe(workspace.id);
    expect(resource.data?.name).toBe(resourceName1);
    expect(resource.data?.kind).toBe("ResourceAPI");
    expect(resource.data?.identifier).toBe(resourceName1);
    expect(resource.data?.version).toBe("test-version/v1");
    expect(resource.data?.config).toEqual({ "e2e-test": true });
    expect(resource.data?.metadata).toEqual({ "e2e-test": "true" });

    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const environment = importedEntities.environments[0]!;
    const deployment = importedEntities.deployments[0]!;

    const environmentResourcesResponse = await api.GET(
      "/v1/environments/{environmentId}/resources",
      { params: { path: { environmentId: environment.id } } },
    );

    expect(environmentResourcesResponse.response.status).toBe(200);
    const environmentResources = environmentResourcesResponse.data?.resources;
    const environmentResourceMatch = environmentResources?.find(
      (r) => r.identifier === resourceName1,
    );
    expect(environmentResourceMatch).toBeDefined();

    const deploymentResourcesResponse = await api.GET(
      "/v1/deployments/{deploymentId}/resources",
      { params: { path: { deploymentId: deployment.id } } },
    );

    expect(deploymentResourcesResponse.response.status).toBe(200);
    const deploymentResources = deploymentResourcesResponse.data?.resources;
    const deploymentResourceMatch = deploymentResources?.find(
      (r) => r.identifier === resourceName1,
    );
    expect(deploymentResourceMatch).toBeDefined();

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId: resource.data?.id ?? "" },
        },
      },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);

    const releaseTarget = releaseTargetsResponse.data?.find(
      (rt) =>
        rt.environment.id === environment.id &&
        rt.deployment.id === deployment.id,
    );
    expect(releaseTarget).toBeDefined();

    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: resource.data?.id ?? "" } },
    });
  });

  test("get a resource by identifier", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceAPI",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    // Then get it by identifier
    const response = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    expect(response.response.status).toBe(200);
    const { data } = response;
    expect(data?.identifier).toBe(resourceName);
    expect(data?.workspaceId).toBe(workspace.id);
  });

  test("list resources", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceAPI",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    // Then list all resources
    const response = await api.GET("/v1/workspaces/{workspaceId}/resources", {
      params: { path: { workspaceId: workspace.id } },
    });

    expect(response.response.status).toBe(200);
    const { data } = response;
    expect(data?.resources).toBeDefined();
    expect(Array.isArray(data?.resources)).toBe(true);

    expect(data?.resources?.length).toBeGreaterThan(0);
  });

  test("update a resource", async ({ api, workspace }) => {
    // First create a resource
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceAPI",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    // Get the resource to update
    const getResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    const { data } = getResponse;
    const resourceId = data?.id ?? "";

    // Update the resource
    const newName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const updateResponse = await api.PATCH("/v1/resources/{resourceId}", {
      params: {
        path: { resourceId },
      },
      body: {
        name: newName,
        metadata: { "e2e-test": "updated" },
      },
    });

    expect(updateResponse.response.status).toBe(200);
    const { data: updatedData } = updateResponse;
    expect(updatedData?.name).toBe(newName);
    expect(updatedData?.metadata?.["e2e-test"]).toBe("updated");

    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const environment = importedEntities.environments[0]!;
    const deployment = importedEntities.deployments[0]!;
    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: { path: { resourceId } },
      },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTarget = releaseTargetsResponse.data?.find(
      (rt) =>
        rt.environment.id === environment.id &&
        rt.deployment.id === deployment.id,
    );
    expect(releaseTarget).toBeDefined();
  });

  test("updating non metadata fields should not change resource's current metadata", async ({
    api,
    workspace,
  }) => {
    // First create a resource
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceAPI",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    // Get the resource to update
    const getResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceName,
          },
        },
      },
    );

    const { data } = getResponse;
    const resourceId = data?.id ?? "";

    // Update the resource
    const newName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const updateResponse = await api.PATCH("/v1/resources/{resourceId}", {
      params: {
        path: { resourceId },
      },
      body: { name: newName },
    });

    expect(updateResponse.response.status).toBe(200);
    const { data: updatedData } = updateResponse;
    expect(updatedData?.name).toBe(newName);
    expect(updatedData?.metadata?.["e2e-test"]).toBe("true");
  });

  test("delete a resource", async ({ api, workspace }) => {
    // First create a resource
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resourceIdentifer = `${resourceName}/${faker.string.alphanumeric(10)}`;
    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceAPI",
        identifier: resourceIdentifer,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data?.id;
    expect(resourceId).toBeDefined();

    // Delete by identifier
    const deleteResponse = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceIdentifer,
          },
        },
      },
    );
    expect(deleteResponse.response.status).toBe(200);
    const { data: deleteData } = deleteResponse;
    expect(deleteData?.success).toBe(true);

    // Verify resource is deleted
    const getResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: resourceIdentifer,
          },
        },
      },
    );
    expect(getResponse.response.status).toBe(404);

    await new Promise((resolve) => setTimeout(resolve, 5_000));

    const environment = importedEntities.environments[0]!;
    const deployment = importedEntities.deployments[0]!;

    const environmentResourcesResponse = await api.GET(
      "/v1/environments/{environmentId}/resources",
      { params: { path: { environmentId: environment.id } } },
    );

    expect(environmentResourcesResponse.response.status).toBe(200);
    const environmentResources = environmentResourcesResponse.data?.resources;
    const environmentResourceMatch = environmentResources?.find(
      (r) => r.identifier === resourceIdentifer,
    );
    expect(environmentResourceMatch).toBeUndefined();

    const deploymentResourcesResponse = await api.GET(
      "/v1/deployments/{deploymentId}/resources",
      { params: { path: { deploymentId: deployment.id } } },
    );

    expect(deploymentResourcesResponse.response.status).toBe(200);
    const deploymentResources = deploymentResourcesResponse.data?.resources;
    const deploymentResourceMatch = deploymentResources?.find(
      (r) => r.identifier === resourceIdentifer,
    );
    expect(deploymentResourceMatch).toBeUndefined();
  });

  test("create resource relationship", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    // Create two resources
    const resource1Name = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resource2Name = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resource1Name,
        kind: "ResourceAPI",
        identifier: resource1Name,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resource2Name,
        kind: "ResourceAPI",
        identifier: resource2Name,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
      },
    });

    // Create relationship between resources
    const { response } = await api.POST(
      "/v1/relationship/resource-to-resource",
      {
        body: {
          workspaceId: workspace.id,
          fromIdentifier: resource1Name,
          toIdentifier: resource2Name,
          type: "depends_on",
        },
      },
    );

    expect(response.status).toBe(200);

    const data = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: resource1Name },
        },
      },
    );

    console.log("data", data);
  });
});
