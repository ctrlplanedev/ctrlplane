import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release.spec.yaml");

test.describe("Release Creation", () => {
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

  test("should create a release when a new version is created", async ({
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
        metadata: { e2e: "true" },
      },
    });
    expect(versionResponse.response.status).toBe(201);

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
    const release = releases.find((rel) => rel.version.tag === versionTag);
    expect(release).toBeDefined();
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

  test("should create a release when a new resource is created", async ({
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

    const release = releases.find((rel) => rel.version.tag === versionTag);
    expect(release).toBeDefined();

    const variables = release?.variables ?? [];
    const testVariable = variables.find((v) => v.key === "test");
    expect(testVariable).toBeDefined();
    expect(testVariable?.value).toBe("test-a");
  });

  test("should create a release when a new resource is created that does not match any policy target", async ({
    api,
    page,
    workspace,
  }) => {
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId: workspace.id,
        targets: [
          {
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${policyName}`,
            },
          },
        ],
      },
    });
    expect(policyResponse.response.status).toBe(200);

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

  test("should create a release whena resource is updated which affects its release targets", async ({
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
        resourceSelector: {
          type: "metadata",
          key: "e2e-test",
          operator: "equals",
          value: "true",
        },
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

    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const resourceCreateResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        metadata: {
          "e2e-test": "false",
        },
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
        body: { metadata: { "e2e-test": "true" } },
      },
    );
    expect(resourceUpdateResponse.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: { path: { resourceId } },
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
          path: { releaseTargetId: releaseTarget?.id ?? "" },
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
  });

  test("should not create a release when an existing resource is updated but the updates are not relevant to the deployment", async ({
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
        body: { version: "1.0.1" },
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

  test("should create a release when a resource is scanned in from a provider", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);
    const deploymentVersionCreateResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: { deploymentId, tag: versionTag },
      },
    );
    expect(deploymentVersionCreateResponse.response.status).toBe(201);

    const providerName = faker.string.alphanumeric(10);
    const providerResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: { workspaceId: workspace.id, name: providerName },
        },
      },
    );

    expect(providerResponse.response.status).toBe(200);
    const { data: provider } = providerResponse;
    expect(provider?.id).toBeDefined();
    const providerId = provider?.id as string;

    // Test data for resources
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    const setResponse = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: { path: { providerId } },
        body: {
          resources: [
            {
              name: resourceName,
              kind: "service",
              identifier: resourceName,
              version: "1.0.0",
              config: {},
              metadata: {},
              variables: [],
            },
          ],
        },
      },
    );

    const { data: setResources } = setResponse;
    const resource = setResources?.resources?.inserted?.at(0);
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    expect(setResponse.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: { path: { resourceId } },
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
        params: { path: { releaseTargetId: releaseTarget?.id ?? "" } },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];
    const release = releases.find((rel) => rel.version.tag === versionTag);
    expect(release).toBeDefined();
  });

  test("should create a release when a resource is updated from a provider", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const environmentCreateResponse = await api.POST("/v1/environments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "comparison",
          operator: "and",
          conditions: [
            {
              type: "metadata",
              operator: "equals",
              key: "running",
              value: "true",
            },
            {
              type: "identifier",
              operator: "contains",
              value: systemPrefix,
            },
          ],
        },
      },
    });
    expect(environmentCreateResponse.response.status).toBe(200);

    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        slug: `${systemPrefix}-${faker.string.alphanumeric(10)}`,
        systemId: builder.refs.system.id,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const versionTag = faker.string.alphanumeric(10);
    const deploymentVersionCreateResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: { deploymentId, tag: versionTag },
      },
    );
    expect(deploymentVersionCreateResponse.response.status).toBe(201);

    const providerName = faker.string.alphanumeric(10);
    const providerResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
      {
        params: {
          path: { workspaceId: workspace.id, name: providerName },
        },
      },
    );

    expect(providerResponse.response.status).toBe(200);
    const { data: provider } = providerResponse;
    expect(provider?.id).toBeDefined();
    const providerId = provider?.id as string;

    // Test data for resources
    const resourceName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;

    await api.PATCH("/v1/resource-providers/{providerId}/set", {
      params: { path: { providerId } },
      body: {
        resources: [
          {
            name: resourceName,
            kind: "service",
            identifier: resourceName,
            version: "1.0.0",
            config: {},
            metadata: { running: "false" },
            variables: [],
          },
        ],
      },
    });

    await page.waitForTimeout(1_000);

    const setResponse2 = await api.PATCH(
      "/v1/resource-providers/{providerId}/set",
      {
        params: { path: { providerId } },
        body: {
          resources: [
            {
              name: resourceName,
              kind: "service",
              identifier: resourceName,
              version: "1.0.0",
              config: {},
              metadata: { running: "true" },
              variables: [],
            },
          ],
        },
      },
    );
    expect(setResponse2.response.status).toBe(200);

    const { data: setResources } = setResponse2;
    const resource = setResources?.resources?.updated?.at(0);
    expect(resource).toBeDefined();
    const resourceId = resource?.id ?? "";

    expect(setResponse2.response.status).toBe(200);

    await page.waitForTimeout(24_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      {
        params: { path: { resourceId } },
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
        params: { path: { releaseTargetId: releaseTarget?.id ?? "" } },
      },
    );

    expect(releaseResponse.response.status).toBe(200);
    const releases = releaseResponse.data ?? [];

    const release = releases.find((rel) => rel.version.tag === versionTag);
    expect(release).toBeDefined();
  });
});
