import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "version-dependency.spec.yaml");

const insertVersionForChild = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
) => {
  const { prefix } = builder.refs;
  const parentDeployment = builder.refs.deployments.find(
    (d) => d.slug === `${prefix}-parent-deployment`,
  )!;
  const childDeployment = builder.refs.deployments.find(
    (d) => d.slug === `${prefix}-child-deployment`,
  )!;

  const versionTag = faker.string.alphanumeric(10);
  const selectorTag = faker.string.alphanumeric(10);

  const deploymentVersionResponse = await api.POST("/v1/deployment-versions", {
    body: {
      tag: versionTag,
      deploymentId: childDeployment.id,
      dependencies: [
        {
          deploymentId: parentDeployment.id,
          versionSelector: {
            type: "tag",
            operator: "equals",
            value: selectorTag,
          },
        },
      ],
    },
  });

  expect(deploymentVersionResponse.response.status).toBe(201);

  return { versionTag, selectorTag };
};

const insertVersionForParent = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
  tag: string,
) => {
  const { prefix } = builder.refs;
  const parentDeployment = builder.refs.deployments.find(
    (d) => d.slug === `${prefix}-parent-deployment`,
  )!;

  const deploymentVersionResponse = await api.POST("/v1/deployment-versions", {
    body: { tag, deploymentId: parentDeployment.id },
  });

  expect(deploymentVersionResponse.response.status).toBe(201);
};

const getReleaseTarget = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
  deploymentId: string,
) => {
  const workspaceId = builder.workspace.id;
  const resourceRef = builder.refs.oneResource();
  const { identifier } = resourceRef;
  const resourceResponse = await api.GET(
    `/v1/workspaces/{workspaceId}/resources/identifier/{identifier}`,
    { params: { path: { workspaceId, identifier } } },
  );
  expect(resourceResponse.response.status).toBe(200);
  const resource = resourceResponse.data;
  expect(resource).toBeDefined();

  const releaseTargetsResponse = await api.GET(
    "/v1/resources/{resourceId}/release-targets",
    { params: { path: { resourceId: resource?.id ?? "" } } },
  );

  const releaseTarget = releaseTargetsResponse.data?.find(
    (rt) => rt.deployment.id === deploymentId,
  );
  expect(releaseTarget).toBeDefined();
  return releaseTarget!;
};

const getRelease = async (
  api: Client<paths, `${string}/${string}`>,
  releaseTargetId: string,
  versionTag: string,
) => {
  const releaseResponse = await api.GET(
    "/v1/release-targets/{releaseTargetId}/releases",
    { params: { path: { releaseTargetId } } },
  );

  return releaseResponse.data?.find((r) => r.version.tag === versionTag);
};

const markJobAsSuccessful = async (
  api: Client<paths, `${string}/${string}`>,
  builder: EntitiesBuilder,
) => {
  const agentId = builder.refs.oneAgent().id;
  const nextJobResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
    params: {
      path: { agentId },
    },
  });
  expect(nextJobResponse.response.status).toBe(200);
  const nextJobId = nextJobResponse.data?.jobs?.[0]?.id;
  expect(nextJobId).toBeDefined();

  const successfulJobResponse = await api.PATCH("/v1/jobs/{jobId}", {
    params: { path: { jobId: nextJobId ?? "" } },
    body: { status: "successful" },
  });

  expect(successfulJobResponse.response.status).toBe(200);
};

test.describe("Version Dependency", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertAgentFixtures();

    const agentId = builder.refs.oneAgent().id;
    await builder.upsertDeploymentFixtures(agentId);
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should not create a release if a dependency is not satisfied", async ({
    api,
    page,
  }) => {
    const { prefix } = builder.refs;
    const childDeployment = builder.refs.deployments.find(
      (d) => d.slug === `${prefix}-child-deployment`,
    )!;
    const { versionTag } = await insertVersionForChild(api, builder);
    const releaseTarget = await getReleaseTarget(
      api,
      builder,
      childDeployment.id,
    );
    await page.waitForTimeout(5_000);
    const release = await getRelease(api, releaseTarget.id, versionTag);
    expect(release).toBeUndefined();
  });

  test("should create a release if a dependency is satisfied", async ({
    api,
    page,
  }) => {
    const { prefix } = builder.refs;
    const childDeployment = builder.refs.deployments.find(
      (d) => d.slug === `${prefix}-child-deployment`,
    )!;
    const { versionTag, selectorTag } = await insertVersionForChild(
      api,
      builder,
    );
    await insertVersionForParent(api, builder, selectorTag);
    await markJobAsSuccessful(api, builder);
    await page.waitForTimeout(5_000);
    const releaseTarget = await getReleaseTarget(
      api,
      builder,
      childDeployment.id,
    );
    const release = await getRelease(api, releaseTarget.id, versionTag);
    expect(release).toBeDefined();
  });
});
