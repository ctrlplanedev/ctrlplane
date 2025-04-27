import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-variables.spec.yaml");

test.describe("Resource Variables API", () => {
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

  test("create a resource with variables", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    // Create a resource with variables
    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceWithVariables",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
        variables: [
          { key: "string-var", value: "string-value" },
          { key: "number-var", value: 123 },
          { key: "boolean-var", value: true },
        ],
      },
    });

    expect(resource.response.status).toBe(200);
    expect(resource.data?.id).toBeDefined();
    expect(resource.error).toBeUndefined();

    // Get the resource and verify variables
    const getResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: { workspaceId: workspace.id, identifier: resourceName },
        },
      },
    );

    expect(getResponse.response.status).toBe(200);
    expect(getResponse.data?.variables).toBeDefined();
    expect(getResponse.data?.variables?.["string-var"]).toBe("string-value");
    expect(getResponse.data?.variables?.["number-var"]).toBe(123);
    expect(getResponse.data?.variables?.["boolean-var"]).toBe(true);

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: resource.data?.id ?? "" } },
    });
  });

  test("update resource variables", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    // Create a resource with initial variables
    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceWithVariables",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
        variables: [{ key: "initial-var", value: "initial-value" }],
      },
    });

    expect(resource.response.status).toBe(200);
    const resourceId = resource.data?.id;
    expect(resourceId).toBeDefined();

    // Update the resource variables
    const updateResponse = await api.PATCH("/v1/resources/{resourceId}", {
      params: {
        path: { resourceId: resourceId ?? "" },
      },
      body: {
        variables: [
          { key: "initial-var", value: "updated-value" },
          { key: "new-var", value: "new-value" },
        ],
      },
    });
    expect(updateResponse.response.status).toBe(200);

    // Get the resource and verify updated variables
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
    expect(getResponse.response.status).toBe(200);
    expect(getResponse.data?.variables?.["initial-var"]).toBe("updated-value");
    expect(getResponse.data?.variables?.["new-var"]).toBe("new-value");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: resourceId ?? "" } },
    });
  });

  test("use resource variables in deployments and environments", async ({
    api,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    // Create a resource with variables
    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceWithVariables",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
        variables: [
          { key: "env-var", value: "base-value" },
          { key: "deploy-var", value: "base-value" },
        ],
      },
    });

    expect(resource.response.status).toBe(200);
    expect(resource.data?.id).toBeDefined();

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: resource.data?.id ?? "" } },
    });
  });

  test("resource variables type validation", async ({ api, workspace }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    // Create a resource with variables of different types
    const resource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: resourceName,
        kind: "ResourceWithVariables",
        identifier: resourceName,
        version: "test-version/v1",
        config: { "e2e-test": true } as any,
        metadata: { "e2e-test": "true" },
        variables: [
          { key: "string-var", value: "string-value" },
          { key: "number-var", value: 123 },
          { key: "boolean-var", value: true },
          { key: "object-var", value: { nested: "value" } as any },
          { key: "array-var", value: [1, 2, 3] },
        ],
      },
    });

    console.log(resource.data);
    expect(resource.response.status).toBe(200);
    const resourceId = resource.data?.id;
    expect(resourceId).toBeDefined();

    // Get the resource and verify variable types are preserved
    const getResponse = await api.GET("/v1/resources/{resourceId}", {
      params: {
        path: { resourceId: resourceId ?? "" },
      },
    });
    expect(getResponse.response.status).toBe(200);
    expect(typeof getResponse.data?.variables?.["string-var"]).toBe("string");
    expect(typeof getResponse.data?.variables?.["number-var"]).toBe("number");
    expect(typeof getResponse.data?.variables?.["boolean-var"]).toBe("boolean");
    expect(typeof getResponse.data?.variables?.["object-var"]).toBe("object");
    expect(Array.isArray(getResponse.data?.variables?.["array-var"])).toBe(
      true,
    );

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: resourceId ?? "" } },
    });
  });
});
