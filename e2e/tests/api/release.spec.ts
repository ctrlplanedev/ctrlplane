import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release.spec.yaml");

test.describe("Release Creation", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("should create a release when a new version is created", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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

    const importedResource = importedEntities.resources.at(0)!;
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(1);

    const release = releases[0]!;
    expect(release.version.tag).toBe(versionTag);
  });

  test("should create a release when a new deployment variable is added", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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
          values: [
            {
              value: "test-a",
              default: true,
            },
            { value: "test-b" },
          ],
        },
      },
    );
    expect(variableCreateResponse.response.status).toBe(201);

    const importedResource = importedEntities.resources.at(0)!;
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(2);

    const latestRelease = releases.at(0)!;
    const variables = latestRelease.variables ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("test");
    expect(variable.value).toBe("test-a");
  });

  test("should create a release when a new resource is created", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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
          values: [
            {
              value: "test-a",
              default: true,
            },
            { value: "test-b" },
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(1);

    const latestRelease = releases.at(0)!;
    expect(latestRelease.version.tag).toBe(versionTag);
    const variables = latestRelease.variables ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("test");
    expect(variable.value).toBe("test-a");
  });

  test("should not create a release when an existing resource is updated", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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
          values: [
            {
              value: "test-a",
              default: true,
            },
            { value: "test-b" },
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(1);

    const latestRelease = releases.at(0)!;
    expect(latestRelease.version.tag).toBe(versionTag);
    const variables = latestRelease.variables ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("test");
    expect(variable.value).toBe("test-a");
  });

  test("should create a release when a resource variable is added and matches a deployment variable", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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
          values: [
            {
              value: "test-a",
              default: true,
            },
            { value: "test-b" },
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(2);

    const latestRelease = releases.at(0)!;
    expect(latestRelease.version.tag).toBe(versionTag);
    const variables = latestRelease.variables ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("test");
    expect(variable.value).toBe("test-c");
  });

  test("should not create a release when a resource variable is added and does not match a deployment variable", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = importedEntities.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: importedEntities.system.id,
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
          values: [
            {
              value: "test-a",
              default: true,
            },
            { value: "test-b" },
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

    await page.waitForTimeout(26_000);

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
    expect(releases.length).toBe(1);

    const latestRelease = releases.at(0)!;
    expect(latestRelease.version.tag).toBe(versionTag);
    const variables = latestRelease.variables ?? [];
    expect(variables.length).toBe(1);
    const variable = variables[0]!;
    expect(variable.key).toBe("test");
    expect(variable.value).toBe("test-a");
  });
});
