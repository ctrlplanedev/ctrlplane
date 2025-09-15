import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import _ from "lodash";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "approval-policy.spec.yaml");

test.describe("Approval Policy", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    await builder.upsertPolicyFixtures();
    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  const createEnvironment = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const { prefix } = builder.refs;
    const environmentResponse = await api.POST("/v1/environments", {
      body: {
        name: faker.string.alphanumeric(10),
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: prefix,
        },
      },
    });

    expect(environmentResponse.response.status).toBe(200);
    const environmentId = environmentResponse.data!.id;
    return environmentId;
  };

  const getReleasesForTarget = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
    environmentId: string,
  ) => {
    const resource = builder.refs.resources[0]!;
    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: builder.workspace.id,
            identifier: resource.identifier,
          },
        },
      },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data!.id;

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId } } },
    );

    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTarget = releaseTargetResponse.data?.find(
      (rt) => rt.environment.id === environmentId,
    );

    expect(releaseTarget).toBeDefined();

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget!.id } } },
    );

    expect(releasesResponse.response.status).toBe(200);
    return releasesResponse.data ?? [];
  };

  test("should not allow a release to be created if the version is not approved", async ({
    api,
    page,
  }) => {
    const environmentId = await createEnvironment(api, builder);

    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    await page.waitForTimeout(20_000);
    const releases = await getReleasesForTarget(api, builder, environmentId!);

    const releaseForVersion = releases.find(
      (release) => release.version.tag === tag,
    );

    expect(releaseForVersion).toBeUndefined();
  });

  test("should allow a release to be created if the version is approved", async ({
    api,
    page,
  }) => {
    const environmentId = await createEnvironment(api, builder);
    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    const approvalResponse = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/approve/environment/{environmentId}",
      {
        params: {
          path: {
            deploymentVersionId: versionResponse.data!.id,
            environmentId,
          },
        },
        body: {},
      },
    );

    expect(approvalResponse.response.status).toBe(200);

    await page.waitForTimeout(20_000);

    const releases = await getReleasesForTarget(api, builder, environmentId!);
    const releaseForVersion = releases.find(
      (release) => release.version.tag === tag,
    );

    expect(releaseForVersion).toBeDefined();
  });

  test("should not allow a release to be created if the version is rejected", async ({
    api,
    page,
  }) => {
    const environmentId = await createEnvironment(api, builder);
    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    const approvalResponse = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/reject/environment/{environmentId}",
      {
        params: {
          path: {
            deploymentVersionId: versionResponse.data!.id,
            environmentId,
          },
        },
        body: {},
      },
    );

    expect(approvalResponse.response.status).toBe(200);

    await page.waitForTimeout(20_000);

    const releases = await getReleasesForTarget(api, builder, environmentId!);
    const releaseForVersion = releases.find(
      (release) => release.version.tag === tag,
    );

    expect(releaseForVersion).toBeUndefined();
  });

  test("should not allow a release to be created for a new resource if the version is not approved", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;

    const environmentId = await createEnvironment(api, builder);
    const system = builder.refs.system;
    const systemPrefix = system.slug.split("-")[0]!;
    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    const createResourceResponse = await api.POST("/v1/resources", {
      body: {
        workspaceId,
        identifier: `${systemPrefix}-b`,
        name: faker.string.alphanumeric(10),
        kind: "container",
        version: "1.0.0",
        config: {},
      },
    });

    expect(createResourceResponse.response.status).toBe(200);

    const resourceId = createResourceResponse.data!.id;

    await page.waitForTimeout(20_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId } } },
    );

    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTarget = releaseTargetResponse.data?.find(
      (rt) => rt.environment.id === environmentId,
    );
    expect(releaseTarget).toBeDefined();

    const releasesResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget!.id } } },
    );

    expect(releasesResponse.response.status).toBe(200);
    const releaseForVersion = releasesResponse.data?.find(
      (release) => release.version.tag === tag,
    );

    expect(releaseForVersion).toBeUndefined();
  });

  test("should be able to approve a version for a specific environment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    const environment1id = await createEnvironment(api, builder);
    const environment2id = await createEnvironment(api, builder);

    const approvalResponse = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/approve/environment/{environmentId}",
      {
        params: {
          path: {
            deploymentVersionId: versionResponse.data!.id,
            environmentId: environment1id,
          },
        },
        body: {
          reason: "test",
        },
      },
    );

    expect(approvalResponse.response.status).toBe(200);

    const resource = builder.refs.resources[0]!;
    const resourceResponse = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId,
            identifier: resource.identifier,
          },
        },
      },
    );

    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data!.id;

    await page.waitForTimeout(20_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId } } },
    );

    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTarget1 = releaseTargetResponse.data?.find(
      (rt) => rt.environment.id === environment1id,
    );

    expect(releaseTarget1).toBeDefined();

    const releaseResponse1 = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget1!.id } } },
    );

    expect(releaseResponse1.response.status).toBe(200);
    const release1 = releaseResponse1.data?.find(
      (rel) => rel.version.tag === tag,
    );

    expect(release1).toBeDefined();

    const releaseTarget2 = releaseTargetResponse.data?.find(
      (rt) => rt.environment.id === environment2id,
    );

    expect(releaseTarget2).toBeDefined();

    const releaseResponse2 = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget2!.id } } },
    );

    expect(releaseResponse2.response.status).toBe(200);
    const release2 = releaseResponse2.data?.find(
      (rel) => rel.version.tag === tag,
    );

    expect(release2).toBeUndefined();
  });

  test("should not allow a user to approve the same version for the same environment twice", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const deployment = builder.refs.deployments[0]!;
    const tag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.id,
        tag,
      },
    });

    expect(versionResponse.response.status).toBe(201);

    const environmentName = faker.string.alphanumeric(10);

    const policyResponse = await api.POST("/v1/policies", {
      body: {
        workspaceId,
        name: faker.string.alphanumeric(10),
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "contains",
              value: environmentName,
            },
          },
        ],
        versionAnyApprovals: {
          requiredApprovalsCount: 2,
        },
      },
    });

    expect(policyResponse.response.status).toBe(200);

    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const environmentResponse = await api.POST("/v1/environments", {
      body: {
        workspaceId,
        name: environmentName,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "contains",
          value: systemPrefix,
        },
      },
    });

    expect(environmentResponse.response.status).toBe(200);
    const environmentId = environmentResponse.data!.id;

    const approvalResponse1 = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/approve/environment/{environmentId}",
      {
        params: {
          path: {
            deploymentVersionId: versionResponse.data!.id,
            environmentId,
          },
        },
        body: {
          reason: "test",
        },
      },
    );

    expect(approvalResponse1.response.status).toBe(200);

    const approvalResponse2 = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/approve/environment/{environmentId}",
      {
        params: {
          path: {
            deploymentVersionId: versionResponse.data!.id,
            environmentId,
          },
        },
        body: {
          reason: "test",
        },
      },
    );

    expect(approvalResponse2.response.status).toBe(409);

    const resource = builder.refs.resources[0]!;
    const resourceResponse = await api.GET(
      `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
      {
        params: {
          path: {
            workspaceId,
            identifier: resource.identifier,
          },
        },
      },
    );

    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data!.id;

    await page.waitForTimeout(20_000);

    const releaseTargetResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId } } },
    );

    expect(releaseTargetResponse.response.status).toBe(200);
    const releaseTarget = releaseTargetResponse.data?.find(
      (rt) => rt.environment.id === environmentId,
    );

    expect(releaseTarget).toBeDefined();

    const releaseResponse = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget!.id } } },
    );

    expect(releaseResponse.response.status).toBe(200);
    const release = releaseResponse.data?.find(
      (rel) => rel.version.tag === tag,
    );

    expect(release).toBeUndefined();
  });
});
