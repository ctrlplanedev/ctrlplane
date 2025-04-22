import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import type { paths } from "../../api/schema";
import { test } from "../fixtures";

test.describe("Resource API", () => {
  test("create a resource", async ({ api, workspace }) => {
    const resourceName1 = faker.string.alphanumeric(10);
    const resourceName2 = faker.string.alphanumeric(10);
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
  });

  test("get a resource by identifier", async ({ api, workspace }) => {
    // First create a resource
    const resourceName = faker.string.alphanumeric(10);
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

    console.log("response", response);

    expect(response.response.status).toBe(200);
    const { data } = response;
    expect(data?.identifier).toBe(resourceName);
    expect(data?.workspaceId).toBe(workspace.id);
  });

  test("list resources", async ({ api, workspace }) => {
    // First create some resources
    const resourceName = faker.string.alphanumeric(10);
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

    console.log("response", response);

    expect(response.response.status).toBe(200);
    const { data } = response;
    expect(data?.resources).toBeDefined();
    expect(Array.isArray(data?.resources)).toBe(true);

    expect(data?.resources?.length).toBeGreaterThan(0);
  });

  test("update a resource", async ({ api, workspace }) => {
    // First create a resource
    const resourceName = faker.string.alphanumeric(10);
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
    const newName = faker.string.alphanumeric(10);
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
  });

  test("delete a resource", async ({ api, workspace }) => {
    // First create a resource
    const resourceName = faker.string.alphanumeric(10);
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

    // Delete by identifier
    const deleteResponse = await api.DELETE(
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
            identifier: resourceName,
          },
        },
      },
    );
    expect(getResponse.response.status).toBe(404);
  });

  test("create resource relationship", async ({ api, workspace }) => {
    // Create two resources
    const resource1Name = faker.string.alphanumeric(10);
    const resource2Name = faker.string.alphanumeric(10);

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
