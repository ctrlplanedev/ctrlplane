import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "release.spec.yaml");

test.describe("Version Release Creation", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertAgentFixtures();
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

  test("should not create a release when a new version is created but is older than the current version deployed to a target", async ({
    api,
    page,
    workspace,
  }) => {
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const { id: agentId } = builder.refs.oneAgent();
    const deploymentName = `${systemPrefix}-${faker.string.alphanumeric(10)}`;
    const deploymentCreateResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
        jobAgentId: agentId,
      },
    });
    expect(deploymentCreateResponse.response.status).toBe(201);
    const deploymentId = deploymentCreateResponse.data?.id ?? "";

    const newerVersionTag = faker.string.alphanumeric(10);
    const olderVersionTag = faker.string.alphanumeric(10);

    const newerCreatedAtDate = new Date(Date.now() - 1000);
    const olderCreatedAtDate = new Date(Date.now() - 2000);

    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: newerVersionTag,
        metadata: { e2e: "true" },
        createdAt: newerCreatedAtDate.toISOString(),
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
    const resourceId = resourceResponse.data?.id ?? "";

    await page.waitForTimeout(12_000);

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
    const newerRelease = releases.find(
      (rel) => rel.version.tag === newerVersionTag,
    );
    expect(newerRelease).toBeDefined();

    const nextJobResponse = await api.GET(
      "/v1/job-agents/{agentId}/queue/next",
      {
        params: {
          path: { agentId },
        },
      },
    );
    expect(nextJobResponse.response.status).toBe(200);
    const nextJobId = nextJobResponse.data?.jobs?.[0]?.id;
    expect(nextJobId).toBeDefined();

    const successfulJobResponse = await api.PATCH("/v1/jobs/{jobId}", {
      params: { path: { jobId: nextJobId ?? "" } },
      body: { status: "successful" },
    });

    expect(successfulJobResponse.response.status).toBe(200);

    const olderVersionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId,
        tag: olderVersionTag,
        metadata: { e2e: "true" },
        createdAt: olderCreatedAtDate.toISOString(),
      },
    });
    expect(olderVersionResponse.response.status).toBe(201);

    await page.waitForTimeout(12_000);

    const nextReleaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );
    expect(nextReleaseResponse.response.status).toBe(200);
    const nextReleases = nextReleaseResponse.data ?? [];
    const nextRelease = nextReleases.find(
      (rel) => rel.version.tag === olderVersionTag,
    );
    expect(nextRelease).toBeUndefined();
  });

  test("should create a release when a version goes from building to ready", async ({
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
        status: "building",
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

    await page.waitForTimeout(12_000);

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

    const initialReleaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: {
            releaseTargetId: releaseTarget?.id ?? "",
          },
        },
      },
    );

    expect(initialReleaseResponse.response.status).toBe(200);
    const initialReleases = initialReleaseResponse.data ?? [];
    const initialRelease = initialReleases.find(
      (rel) => rel.version.tag === versionTag,
    );
    expect(initialRelease).toBeUndefined();

    const updateVersionResponse = await api.PATCH(
      "/v1/deployment-versions/{deploymentVersionId}",
      {
        params: {
          path: { deploymentVersionId: versionResponse.data?.id ?? "" },
        },
        body: { status: "ready" },
      },
    );
    expect(updateVersionResponse.response.status).toBe(200);

    await page.waitForTimeout(12_000);

    const nextReleaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      {
        params: {
          path: { releaseTargetId: releaseTarget?.id ?? "" },
        },
      },
    );
    expect(nextReleaseResponse.response.status).toBe(200);
    const nextReleases = nextReleaseResponse.data ?? [];
    const nextRelease = nextReleases.find(
      (rel) => rel.version.tag === versionTag,
    );
    expect(nextRelease).toBeDefined();
  });
});
