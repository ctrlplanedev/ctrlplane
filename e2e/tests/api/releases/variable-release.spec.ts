import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "release.spec.yaml");

test.describe("Variable Release Creation", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should create a release when a new deployment variable is added", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: { deploymentId },
        },
        body: {
          key: "test",
          description: "test",
          config: {
            type: "string",
            inputType: "text",
          },
          directValues: [
            {
              value: "test-a",
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
            {
              value: "test-b",
              sensitive: false,
              resourceSelector: null,
            },
          ],
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    const importedResource = builder.refs.resources.at(0)!;
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedResource.identifier,
          },
        },
      },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resource = resourceResponse.data;
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    const releaseTarget = releaseTargets.find(
      (rt) => rt.deployment.id === deploymentId,
    );
    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];

    const release = releases.find((rel) => {
      const variables = rel.variables ?? [];
      const testVariable = variables.find((v) => v.key === "test");
      if (testVariable == null) return false;
      const value = testVariable.value;
      return value === "test-a";
    });

    expect(release).toBeDefined();
  });

  test("should create a release with a null variable value", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: { deploymentId },
        },
        body: {
          key: "test",
          description: "test",
          config: {
            type: "string",
            inputType: "text",
          },
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    const importedResource = builder.refs.resources.at(0)!;
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedResource.identifier,
          },
        },
      },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resource = resourceResponse.data;
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: {
            resourceId,
          },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    const releaseTarget = releaseTargets.find(
      (rt) => rt.deployment.id === deploymentId,
    );
    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];

    const release = releases.find((rel) => {
      const variables = rel.variables ?? [];
      const testVariable = variables.find((v) => v.key === "test");
      if (testVariable == null) return false;
      const value = testVariable.value;
      return value === "null";
    });

    expect(release).toBeDefined();
  });

  test("should create a release when a resource variable is added and matches a deployment variable", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: { deploymentId },
        },
        body: {
          key: "test",
          description: "test",
          config: {
            type: "string",
            inputType: "text",
          },
          directValues: [
            {
              value: "test-a",
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
            {
              value: "test-b",
              sensitive: false,
              resourceSelector: null,
            },
          ],
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {},
        variables: [],
        workspaceId: workspace.id,
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(1_000);

    const resourceUpdateResponse = await api.PATCH(
      "/v1/resources/{resourceId}",
      {
        params: { path: { resourceId } },
        body: { variables: [{ key: "test", value: "test-c" }] },
      },
    );
    expect(resourceUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    const releaseTarget = releaseTargets.find(
      (rt) => rt.deployment.id === deploymentId,
    );
    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    for (const release of releases) {
      console.log(release);
    }

    const release = releases.find((rel) => rel.version.tag === versionTag);

    expect(release).toBeDefined();

    const variables = release?.variables ?? [];
    const testVariable = variables.find((v) => v.key === "test");
    expect(testVariable).toBeDefined();
    expect(testVariable?.value).toBe("test-c");
  });

  test("should handle adding a boolean string variable i.e. 'true' or 'false'", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    const variableKey = faker.string.alphanumeric(10);
    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: { deploymentId },
        },
        body: {
          key: variableKey,
          description: "test",
          config: {
            type: "string",
            inputType: "text",
          },
          directValues: [
            {
              value: "false",
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
          ],
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {},
        variables: [],
        workspaceId: workspace.id,
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(1_000);

    const resourceUpdateResponse = await api.PATCH(
      "/v1/resources/{resourceId}",
      {
        params: { path: { resourceId } },
        body: { variables: [{ key: variableKey, value: "true" }] },
      },
    );
    expect(resourceUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    const releaseTarget = releaseTargets.find(
      (rt) => rt.deployment.id === deploymentId,
    );
    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];

    const release = releases.find((rel) => {
      if (rel.version.tag !== versionTag) return false;
      const variables = rel.variables ?? [];
      const testVariable = variables.find((v) => v.key === variableKey);
      if (testVariable == null) return false;
      return testVariable.value === "true";
    });

    expect(release).toBeDefined();
  });

  test("should not create a release when a resource variable is added and does not match a deployment variable", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    const variableCreateResponse = await api.POST(
      "/v1/deployments/{deploymentId}/variables",
      {
        params: {
          path: { deploymentId },
        },
        body: {
          key: "test",
          description: "test",
          config: {
            type: "string",
            inputType: "text",
          },
          directValues: [
            {
              value: "test-a",
              sensitive: false,
              resourceSelector: null,
              isDefault: true,
            },
            {
              value: "test-b",
              sensitive: false,
              resourceSelector: null,
            },
          ],
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    await page.waitForTimeout(1_000);

    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {},
        variables: [],
        workspaceId: workspace.id,
      },
    });
    expect(resourceCreateResponse.response.status).toBe(200);
    const resourceId = resourceCreateResponse.data?.id ?? "";

    await page.waitForTimeout(1_000);

    const resourceUpdateResponse = await api.PATCH(
      "/v1/resources/{resourceId}",
      {
        params: { path: { resourceId } },
        body: { variables: [{ key: "test-2", value: "test-c" }] },
      },
    );
    expect(resourceUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: {
          path: { resourceId },
        },
      },
    );
    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetResponse.data ?? [];
    const releaseTarget = releaseTargets.find(
      (rt) => rt.deployment.id === deploymentId,
    );
    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    for (const release of releases) {
      console.log(release);
    }

    const release = releases.find((rel) => rel.version.tag === versionTag);
    expect(release).toBeDefined();

    const variables = release?.variables ?? [];
    const testVariable = variables.find((v) => v.key === "test");
    expect(testVariable).toBeDefined();
    expect(testVariable?.value).toBe("test-a");
  });
});
