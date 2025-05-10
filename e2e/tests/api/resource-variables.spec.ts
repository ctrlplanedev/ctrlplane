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
          {
            key: "reference-var",
            defaultValue: "test",
            reference: "test",
            path: ["test"],
          },
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
    expect(getResponse.data?.variables?.["reference-var"]).toBe("test");

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

  test("reference variables from related resources", async ({
    api,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug
      .split("-")[0]!
      .toLowerCase();

    // Create target resource
    const targetResource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-target`,
        kind: "Target",
        identifier: `${systemPrefix}-target`,
        version: `${systemPrefix}-version/v1`,
        config: { "e2e-test": true } as any,
        metadata: {
          "e2e-test": "true",
          [systemPrefix]: "true",
        },
      },
    });
    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.id).toBeDefined();

    // Create source resource
    const sourceResource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-source`,
        kind: "Source",
        identifier: `${systemPrefix}-source`,
        version: `${systemPrefix}-version/v1`,
        config: { "e2e-test": true } as any,
        metadata: {
          "e2e-test": "true",
          [systemPrefix]: "true",
        },
        variables: [
          {
            key: "ref-var",
            reference: systemPrefix,
            path: ["e2e-test"],
          },
        ],
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference: systemPrefix,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatch: ["e2e-test", systemPrefix],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Verify reference resolves
    const getSource = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: `${systemPrefix}-source`,
          },
        },
      },
    );
    expect(getSource.response.status).toBe(200);
    expect(getSource.data?.relationships?.[systemPrefix]?.target?.id).toBe(
      targetResource.data?.id,
    );
    expect(getSource.data?.variables?.["ref-var"]).toBe("true");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });
});
