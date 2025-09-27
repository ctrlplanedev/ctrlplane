import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-variables.spec.yaml");

test.describe("Resource Variables API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("create a resource with variables", async ({ api, workspace }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
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
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
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
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
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
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();

    // Create target resource
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
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create source resource
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
        variables: [
          {
            key: "ref-var",
            reference,
            path: ["metadata", "e2e-test"],
          },
        ],
      },
    });
    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.id).toBeDefined();

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    await page.waitForTimeout(15_000);

    // Verify reference resolves
    const getTarget = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: `${systemPrefix}-target`,
          },
        },
      },
    );
    expect(getTarget.response.status).toBe(200);
    expect(getTarget.data?.relationships?.[reference]?.source?.id).toBe(
      sourceResource.data?.id,
    );
    expect(getTarget.data?.variables?.["ref-var"]).toBe("true");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });

  test("reference variables from related resources when the deployment variable value is reference type", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();
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
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create source resource
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
    const targetResourceId = targetResource.data?.id;

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Create a deployment variable with reference type
    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    await page.waitForTimeout(5_000);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key: "ref-var",
        config: {
          type: "string",
          inputType: "text",
        },
        referenceValues: [
          {
            reference,
            path: ["metadata", "e2e-test"],
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          },
        ],
      },
    });

    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag: faker.string.alphanumeric(10),
      },
    });

    await page.waitForTimeout(15_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: targetResourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === targetResourceId &&
        rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const latestRelease = releasesResponse.data?.at(0);

    expect(latestRelease).toBeDefined();

    const variables = latestRelease?.variables ?? [];

    const refVar = variables.find((v) => v.key === "ref-var");
    expect(refVar).toBeDefined();
    expect(refVar?.value).toBe("true");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
  });

  test("reference variables from related resources' variables when the deployment variable value is reference type", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();
    // Create target resource
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
            key: `${systemPrefix}-ref-var`,
            value: "true",
          },
        ],
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create source resource
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
    const targetResourceId = targetResource.data?.id;

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Create a deployment variable with reference type
    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    await page.waitForTimeout(5_000);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key: "ref-var",
        config: {
          type: "string",
          inputType: "text",
        },
        referenceValues: [
          {
            reference,
            path: ["variables", `${systemPrefix}-ref-var`],
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          },
        ],
      },
    });

    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag: faker.string.alphanumeric(10),
      },
    });

    await page.waitForTimeout(15_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: targetResourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === targetResourceId &&
        rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const latestRelease = releasesResponse.data?.at(0);

    expect(latestRelease).toBeDefined();

    const variables = latestRelease?.variables ?? [];

    const refVar = variables.find((v) => v.key === "ref-var");
    expect(refVar).toBeDefined();
    expect(refVar?.value).toBe("true");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });

  test("reference variables from related resources' variables when the deployment variable value is reference type 2", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();
    // Create target resource
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
          "secrets/latest-version": "v1",
        },
        variables: [
          {
            key: `${systemPrefix}-ref-var`,
            value: "true",
          },
        ],
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create source resource
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
    const targetResourceId = targetResource.data?.id;

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Create a deployment variable with reference type
    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    await page.waitForTimeout(5_000);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key: "ref-var",
        config: {
          type: "string",
          inputType: "text",
        },
        referenceValues: [
          {
            reference,
            path: ["metadata", "secrets/latest-version"],
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          },
        ],
      },
    });

    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag: faker.string.alphanumeric(10),
      },
    });

    await page.waitForTimeout(15_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: targetResourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === targetResourceId &&
        rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const latestRelease = releasesResponse.data?.at(0);

    expect(latestRelease).toBeDefined();

    const variables = latestRelease?.variables ?? [];

    const refVar = variables.find((v) => v.key === "ref-var");
    expect(refVar).toBeDefined();
    expect(refVar?.value).toBe("v1");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });

  test("should break a tie between two deployment variable values matching a resource with different priorities", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const resourceIdentifier = faker.string.alphanumeric(10).toLowerCase();

    const resourceResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-resource`,
        kind: "Target",
        identifier: `${systemPrefix}-${resourceIdentifier}`,
        version: `${systemPrefix}-version/v1`,
        config: { "e2e-test": true } as any,
        metadata: {
          "e2e-test": "true",
          [systemPrefix]: "true",
        },
      },
    });
    expect(resourceResponse.response.status).toBe(200);
    expect(resourceResponse.data?.id).toBeDefined();
    const resourceId = resourceResponse.data?.id;

    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    await page.waitForTimeout(5_000);

    const key = faker.string.alphanumeric(10);
    const lowerPriorityValue = faker.string.alphanumeric(10);
    const higherPriorityValue = faker.string.alphanumeric(10);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key,
        config: {
          type: "string",
          inputType: "text",
        },
        directValues: [
          {
            value: lowerPriorityValue,
            priority: 1,
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: resourceIdentifier,
            },
          },
          {
            value: higherPriorityValue,
            priority: 2,
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: resourceIdentifier,
            },
          },
        ],
      },
    });

    const tag = faker.string.alphanumeric(10);
    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag,
      },
    });

    await page.waitForTimeout(5_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: resourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === resourceId && rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const releaseForTag = releasesResponse.data?.find(
      (r) => r.version.tag === tag,
    );
    expect(releaseForTag).toBeDefined();

    const variables = releaseForTag?.variables ?? [];
    const varForKey = variables.find((v) => v.key === key);
    expect(varForKey).toBeDefined();
    expect(varForKey?.value).toBe(higherPriorityValue);
  });

  test("should trigger a release target evaluation if a referenced resource is updated", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();

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
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();
    const sourceResourceId = sourceResource.data?.id ?? "";

    // Create source resource
    const targetResource = await api.POST("/v1/resources", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-source`,
        kind: "Target",
        identifier: `${systemPrefix}-target`,
        version: `${systemPrefix}-version/v1`,
        config: { "e2e-test": true } as any,
        metadata: {
          "e2e-test": "true",
          [systemPrefix]: "true",
          reference: "true",
        },
      },
    });
    expect(targetResource.response.status).toBe(200);
    expect(targetResource.data?.id).toBeDefined();
    const targetResourceId = targetResource.data?.id;

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Create a deployment variable with reference type
    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    await page.waitForTimeout(5_000);

    const key = faker.string.alphanumeric(10);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key,
        config: {
          type: "string",
          inputType: "text",
        },
        referenceValues: [
          {
            reference,
            path: ["metadata", "reference"],
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          },
        ],
      },
    });

    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag: faker.string.alphanumeric(10),
      },
    });

    await page.waitForTimeout(5_000);

    const patchResponse = await api.PATCH("/v1/resources/{resourceId}", {
      params: {
        path: {
          resourceId: sourceResourceId,
        },
      },
      body: {
        metadata: {
          [systemPrefix]: "true",
          "e2e-test": "true",
          reference: "false",
        },
      },
    });
    expect(patchResponse.response.status).toBe(200);

    await page.waitForTimeout(15_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: targetResourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === targetResourceId &&
        rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const latestRelease = releasesResponse.data?.at(0);

    expect(latestRelease).toBeDefined();

    const variables = latestRelease?.variables ?? [];

    const refVar = variables.find((v) => v.key === key);
    expect(refVar).toBeDefined();
    expect(refVar?.value).toBe("false");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: sourceResource.data?.id ?? "" } },
    });
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });

  test("should trigger a release target evaluation if a related resource is deleted and its variables are referenced", async ({
    api,
    workspace,
    page,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const reference = faker.string.alphanumeric(10).toLowerCase();

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
          reference: "true",
          "e2e-test": "true",
          [systemPrefix]: "true",
        },
      },
    });
    expect(sourceResource.response.status).toBe(200);
    expect(sourceResource.data?.id).toBeDefined();

    // Create source resource
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
    const targetResourceId = targetResource.data?.id;

    // Create relationship rule
    const relationship = await api.POST("/v1/resource-relationship-rules", {
      body: {
        workspaceId: workspace.id,
        name: `${systemPrefix}-relationship`,
        reference,
        dependencyType: "depends_on",
        sourceKind: "Source",
        sourceVersion: `${systemPrefix}-version/v1`,
        targetKind: "Target",
        targetVersion: `${systemPrefix}-version/v1`,
        metadataKeysMatches: [
          { sourceKey: "e2e-test", targetKey: systemPrefix },
        ],
      },
    });

    expect(relationship.response.status).toBe(200);

    // Create a deployment variable with reference type
    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        slug: faker.string.alphanumeric(10),
      },
    });
    expect(deploymentResponse.response.status).toBe(201);
    const deploymentId = deploymentResponse.data?.id ?? "";

    const key = faker.string.alphanumeric(10);

    await api.POST("/v1/deployments/{deploymentId}/variables", {
      params: {
        path: {
          deploymentId: deploymentId,
        },
      },
      body: {
        key,
        config: {
          type: "string",
          inputType: "text",
        },
        referenceValues: [
          {
            reference,
            path: ["metadata", "reference"],
            resourceSelector: {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          },
        ],
      },
    });

    await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentId,
        tag: faker.string.alphanumeric(10),
      },
    });

    await page.waitForTimeout(5_000);

    const deleteTargetResponse = await api.DELETE(
      "/v1/resources/{resourceId}",
      {
        params: { path: { resourceId: sourceResource.data?.id ?? "" } },
      },
    );

    expect(deleteTargetResponse.response.status).toBe(200);
    await page.waitForTimeout(15_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId: targetResourceId ?? "",
          },
        },
      },
    );

    const releaseTargets = releaseTargetsResponse.data ?? [];

    const releaseTarget = releaseTargets.find(
      (rt) =>
        rt.resource.id === targetResourceId &&
        rt.deployment.id === deploymentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseTargetId = releaseTarget?.id ?? "";

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTargetId,
          },
        },
      },
    );

    const latestRelease = releasesResponse.data?.at(0);

    expect(latestRelease).toBeDefined();

    const variables = latestRelease?.variables ?? [];

    const refVar = variables.find((v) => v.key === key);
    expect(refVar).toBeDefined();
    expect(refVar?.value).toBe("null");

    // Cleanup
    await api.DELETE("/v1/resources/{resourceId}", {
      params: { path: { resourceId: targetResource.data?.id ?? "" } },
    });
  });
});
