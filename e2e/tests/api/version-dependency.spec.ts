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
) => {
  const { prefix } = builder.refs;
  const deploymentId = builder.refs.deployments.find(
    (d) => d.slug === `${prefix}-child-deployment`,
  )!.id;

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
  agentName: string,
) => {
  const agentId = builder.refs.getAgentLike(agentName).id;
  const nextJobResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
    params: { path: { agentId } },
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

    const agentId = builder.refs.getAgentLike("agent-1").id;
    await builder.upsertDeploymentFixtures(agentId);
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should not create a release if a dependency is not satisfied", async ({
    api,
    page,
  }) => {
    const { versionTag } = await insertVersionForChild(api, builder);
    const releaseTarget = await getReleaseTarget(api, builder);
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
    await markJobAsSuccessful(api, builder, "agent-1");
    await page.waitForTimeout(5_000);
    const releaseTarget = await getReleaseTarget(api, builder);
    const release = await getRelease(api, releaseTarget.id, versionTag);
    expect(release).toBeDefined();
  });

  const createExternalSystem = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const { prefix } = builder.refs;
    const externalSystem = await api.POST("/v1/systems", {
      body: {
        name: `${prefix}-parent-system`,
        slug: `${prefix}-parent-system`,
        description: "External system for testing version dependencies",
        workspaceId: builder.workspace.id,
      },
    });
    expect(externalSystem.response.status).toBe(201);
    return externalSystem.data?.id ?? "";
  };

  const createExternalParentDeployment = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
    externalSystemId: string,
  ) => {
    const agentId = builder.refs.getAgentLike("agent-2").id;

    const { prefix } = builder.refs;
    const externalParentDeployment = await api.POST("/v1/deployments", {
      body: {
        name: `${prefix}-parent-deployment-2`,
        slug: `${prefix}-parent-deployment-2`,
        description: "Parent deployment for testing version dependencies",
        systemId: externalSystemId,
        jobAgentId: agentId,
      },
    });
    expect(externalParentDeployment.response.status).toBe(201);
    return externalParentDeployment.data?.id ?? "";
  };

  const createExternalParentEnvironment = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
    externalSystemId: string,
  ) => {
    const { prefix } = builder.refs;
    const externalParentEnvironment = await api.POST("/v1/environments", {
      body: {
        name: `${prefix}-parent-environment`,
        slug: `${prefix}-parent-environment`,
        description: "Parent environment for testing version dependencies",
        systemId: externalSystemId,
        resourceSelector: {
          type: "comparison",
          operator: "and",
          conditions: [
            {
              type: "identifier",
              operator: "contains",
              value: prefix,
            },
            {
              type: "kind",
              operator: "equals",
              value: `${prefix}-parent-service`,
            },
          ],
        },
      },
    });
    expect(externalParentEnvironment.response.status).toBe(200);
  };

  const createExternalParentResource = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const { prefix } = builder.refs;
    const externalParentResource = await api.POST("/v1/resources", {
      body: {
        name: `${prefix}-parent-resource`,
        kind: `${prefix}-parent-service`,
        identifier: `${prefix}-parent-resource`,
        version: "1.0.0",
        config: {},
        workspaceId: builder.workspace.id,
        metadata: { e2e: "true" },
      },
    });
    expect(externalParentResource.response.status).toBe(200);
    return externalParentResource.data?.id ?? "";
  };

  const createExternalParentResourceRelationship = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
  ) => {
    const { prefix } = builder.refs;
    const reference = faker.string.numeric(10);

    const resourceRelationshipRuleResponse = await api.POST(
      "/v1/resource-relationship-rules",
      {
        body: {
          workspaceId: builder.workspace.id,
          name: `${prefix}-parent-resource-relationship`,
          reference,
          dependencyType: "depends on",
          dependencyDescription:
            "Parent resource for testing version dependencies",
          sourceKind: `${prefix}-parent-service`,
          sourceVersion: "1.0.0",
          targetKind: "service",
          targetVersion: "1.0.0",
          metadataKeysMatches: [{ sourceKey: "e2e", targetKey: "e2e" }],
        },
      },
    );
    expect(resourceRelationshipRuleResponse.response.status).toBe(200);
    return resourceRelationshipRuleResponse.data?.id ?? "";
  };

  const insertVersionForChildWithExternalDependency = async (
    api: Client<paths, `${string}/${string}`>,
    builder: EntitiesBuilder,
    externalDeploymentId: string,
  ) => {
    const { prefix } = builder.refs;
    const childDeployment = builder.refs.deployments.find(
      (d) => d.slug === `${prefix}-child-deployment`,
    )!;

    const versionTag = faker.string.alphanumeric(10);
    const selectorTag = faker.string.alphanumeric(10);

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: versionTag,
          deploymentId: childDeployment.id,
          dependencies: [
            {
              deploymentId: externalDeploymentId,
              versionSelector: {
                type: "tag",
                operator: "equals",
                value: selectorTag,
              },
            },
          ],
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);

    return { versionTag, selectorTag };
  };

  const insertVersionForParentDeployment = async (
    api: Client<paths, `${string}/${string}`>,
    externalDeploymentId: string,
    versionTag: string,
  ) => {
    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          tag: versionTag,
          deploymentId: externalDeploymentId,
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
  };

  const cleanupExternalParentResource = async (
    api: Client<paths, `${string}/${string}`>,
    externalParentResourceId: string,
  ) => {
    const deleteResponse = await api.DELETE(`/v1/resources/{resourceId}`, {
      params: { path: { resourceId: externalParentResourceId } },
    });
    expect(deleteResponse.response.status).toBe(200);
  };

  const cleanupRelationshipRule = async (
    api: Client<paths, `${string}/${string}`>,
    externalParentResourceRelationshipId: string,
  ) => {
    const deleteResponse = await api.DELETE(
      `/v1/resource-relationship-rules/{ruleId}`,
      {
        params: { path: { ruleId: externalParentResourceRelationshipId } },
      },
    );
    expect(deleteResponse.response.status).toBe(200);
  };

  test("should handle a version dependency on an external parent resource", async ({
    api,
    page,
  }) => {
    const externalSystem = await createExternalSystem(api, builder);
    const externalParentDeploymentId = await createExternalParentDeployment(
      api,
      builder,
      externalSystem,
    );
    await createExternalParentEnvironment(api, builder, externalSystem);

    const externalParentResourceId = await createExternalParentResource(
      api,
      builder,
    );
    const externalParentResourceRelationshipId =
      await createExternalParentResourceRelationship(api, builder);

    const { versionTag, selectorTag } =
      await insertVersionForChildWithExternalDependency(
        api,
        builder,
        externalParentDeploymentId,
      );

    const releaseTarget = await getReleaseTarget(api, builder);
    await page.waitForTimeout(5_000);
    const initialReleaseResult = await getRelease(
      api,
      releaseTarget.id,
      versionTag,
    );

    expect(initialReleaseResult).toBeUndefined();

    await insertVersionForParentDeployment(
      api,
      externalParentDeploymentId,
      selectorTag,
    );
    await markJobAsSuccessful(api, builder, "agent-2");
    await page.waitForTimeout(5_000);
    const finalReleaseResult = await getRelease(
      api,
      releaseTarget.id,
      versionTag,
    );

    expect(finalReleaseResult).toBeDefined();

    await cleanupExternalParentResource(api, externalParentResourceId);
    await cleanupRelationshipRule(api, externalParentResourceRelationshipId);
  });
});
