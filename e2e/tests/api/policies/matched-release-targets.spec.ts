import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import _ from "lodash";

import { cleanupImportedEntities, EntitiesBuilder } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "matched-release-targets.spec.yaml");

test.describe("Release Targets API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should match a policy to a specific resource", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const prodResourceMatch =
      releaseTargets?.filter(
        (rt) => rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodResourceMatch.length).toBe(4);

    const qaResourceMatch =
      releaseTargets?.filter(
        (rt) => rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaResourceMatch.length).toBe(0);
  });

  test("should update release targets when resource selector is updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-qa`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const qaResourceMatch =
      releaseTargets?.filter(
        (rt) => rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaResourceMatch.length).toBe(4);

    const prodResourceMatch =
      releaseTargets?.filter(
        (rt) => rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodResourceMatch.length).toBe(0);
  });

  test("should not match a resource that is deleted", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const resourceName = `${systemPrefix}-sample`;
    const sampleResourceResponse = await api.POST("/v1/resources", {
      body: {
        name: resourceName,
        kind: "service",
        identifier: resourceName,
        version: "1.0.0",
        config: {},
        workspaceId,
      },
    });

    expect(sampleResourceResponse.response.status).toBe(200);

    await page.waitForTimeout(1_000);

    const deleteResourceResponse = await api.DELETE(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: { path: { workspaceId, identifier: resourceName } },
      },
    );

    expect(deleteResourceResponse.response.status).toBe(200);

    await page.waitForTimeout(1_000);

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: resourceName,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(0);
  });

  test("should match a policy to a specific environment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const aEnvironmentMatch =
      releaseTargets?.filter(
        (rt) => rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(aEnvironmentMatch.length).toBe(4);

    const bEnvironmentMatch =
      releaseTargets?.filter(
        (rt) => rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(bEnvironmentMatch.length).toBe(0);
  });

  test("should update release targets when environment selector is updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-b`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const bEnvironmentMatch =
      releaseTargets?.filter(
        (rt) => rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(bEnvironmentMatch.length).toBe(4);

    const aEnvironmentMatch =
      releaseTargets?.filter(
        (rt) => rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(aEnvironmentMatch.length).toBe(0);
  });

  test("should not match an environment that is deleted", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const environmentName = `${systemPrefix}-staging`;

    const environmentResponse = await api.POST("/v1/environments", {
      body: {
        name: environmentName,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "equals",
          value: `${systemPrefix}-prod`,
        },
      },
    });

    expect(environmentResponse.response.status).toBe(200);
    const environmentIdResponse = environmentResponse.data?.id;
    expect(environmentIdResponse).toBeDefined();
    const environmentId = environmentIdResponse ?? "";

    await page.waitForTimeout(1_000);

    const deleteEnvironmentResponse = await api.DELETE(
      "/v1/environments/{environmentId}",
      {
        params: { path: { environmentId } },
      },
    );

    expect(deleteEnvironmentResponse.response.status).toBe(200);

    await page.waitForTimeout(1_000);

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: environmentName,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(0);
  });

  test("should match a policy to a specific deployment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const aDeploymentMatch =
      releaseTargets?.filter(
        (rt) => rt.deployment.slug === `${systemPrefix}-deployment-a`,
      ) ?? [];
    expect(aDeploymentMatch.length).toBe(4);

    const bDeploymentMatch =
      releaseTargets?.filter(
        (rt) => rt.deployment.slug === `${systemPrefix}-deployment-b`,
      ) ?? [];
    expect(bDeploymentMatch.length).toBe(0);
  });

  test("should update release targets when deployment selector is updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(1_000);

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-b`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(4);

    const bDeploymentMatch =
      releaseTargets?.filter(
        (rt) => rt.deployment.slug === `${systemPrefix}-deployment-b`,
      ) ?? [];
    expect(bDeploymentMatch.length).toBe(4);

    const aDeploymentMatch =
      releaseTargets?.filter(
        (rt) => rt.deployment.slug === `${systemPrefix}-deployment-a`,
      ) ?? [];
    expect(aDeploymentMatch.length).toBe(0);
  });

  test("should not match a deployment that is deleted", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const deploymentName = `${systemPrefix}-deployment-c`;

    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        name: deploymentName,
        slug: deploymentName,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "equals",
          value: `${systemPrefix}-prod`,
        },
      },
    });

    expect(deploymentResponse.response.status).toBe(201);
    const deploymentIdResponse = deploymentResponse.data?.id;
    expect(deploymentIdResponse).toBeDefined();
    const deploymentId = deploymentIdResponse ?? "";

    await page.waitForTimeout(1_000);

    const deleteDeploymentResponse = await api.DELETE(
      "/v1/deployments/{deploymentId}",
      {
        params: { path: { deploymentId } },
      },
    );

    expect(deleteDeploymentResponse.response.status).toBe(200);

    await page.waitForTimeout(1_000);

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: deploymentName,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(0);
  });

  test("should match a policy to a specific deployment and environment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const deploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(deploymentAEnvironmentAMatch.length).toBe(2);

    const deploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(deploymentBEnvironmentAMatch.length).toBe(0);

    const deploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(deploymentAEnvironmentBMatch.length).toBe(0);

    const deploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(deploymentBEnvironmentBMatch.length).toBe(0);
  });

  test("should update release targets when deployment and environment selectors are updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(1_000);

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-b`,
            },
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-b`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const deploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(deploymentAEnvironmentAMatch.length).toBe(0);

    const deploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a`,
      ) ?? [];
    expect(deploymentBEnvironmentAMatch.length).toBe(0);

    const deploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(deploymentAEnvironmentBMatch.length).toBe(0);

    const deploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b`,
      ) ?? [];
    expect(deploymentBEnvironmentBMatch.length).toBe(2);
  });

  test("should match a policy to a specific resource and environment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const prodEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodEnvironmentAMatch.length).toBe(2);

    const prodEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodEnvironmentBMatch.length).toBe(0);

    const qaEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaEnvironmentAMatch.length).toBe(0);

    const qaEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaEnvironmentBMatch.length).toBe(0);
  });

  test("should update release targets when resource and environment selectors are updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-b`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-qa`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const prodEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodEnvironmentAMatch.length).toBe(0);

    const prodEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodEnvironmentBMatch.length).toBe(0);

    const qaEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaEnvironmentAMatch.length).toBe(0);

    const qaEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaEnvironmentBMatch.length).toBe(2);
  });

  test("should match a policy to a specific resource and deployment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const prodDeploymentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAMatch.length).toBe(2);

    const prodDeploymentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBMatch.length).toBe(0);

    const qaDeploymentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAMatch.length).toBe(0);

    const qaDeploymentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBMatch.length).toBe(0);
  });

  test("should update release targets when resource and deployment selectors are updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(1_000);

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-b`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-qa`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(2);

    const prodDeploymentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAMatch.length).toBe(0);

    const prodDeploymentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBMatch.length).toBe(0);

    const qaDeploymentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAMatch.length).toBe(0);

    const qaDeploymentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBMatch.length).toBe(2);
  });

  test("should match a policy to a specific resource and deployment and environment", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;

    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(1);

    const prodDeploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAEnvironmentAMatch.length).toBe(1);

    const prodDeploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAEnvironmentBMatch.length).toBe(0);

    const prodDeploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBEnvironmentAMatch.length).toBe(0);

    const prodDeploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBEnvironmentBMatch.length).toBe(0);

    const qaDeploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAEnvironmentAMatch.length).toBe(0);

    const qaDeploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAEnvironmentBMatch.length).toBe(0);

    const qaDeploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBEnvironmentAMatch.length).toBe(0);

    const qaDeploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBEnvironmentBMatch.length).toBe(0);
  });

  test("should update release targets when resource and deployment and environment selectors are updated", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;
    const systemPrefix = builder.refs.system.slug.split("-")[0]!;
    const policyName = faker.string.alphanumeric(10);
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: policyName,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-a`,
            },
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-a`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-prod`,
            },
          },
        ],
      },
    });

    expect(policyResponse.response.status).toBe(200);
    const policyIdResponse = policyResponse.data?.id;
    expect(policyIdResponse).toBeDefined();
    const policyId = policyIdResponse ?? "";

    const updatePolicyResponse = await api.PATCH("/v1/policies/{policyId}", {
      params: { path: { policyId } },
      body: {
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: `${systemPrefix}-deployment-b`,
            },
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${systemPrefix}-b`,
            },
            resourceSelector: {
              type: "identifier",
              operator: "equals",
              value: `${systemPrefix}-qa`,
            },
          },
        ],
      },
    });

    expect(updatePolicyResponse.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;
    const count = releaseTargetsResponse.data?.count;
    expect(releaseTargets).toBeDefined();

    expect(count).toBe(1);

    const prodDeploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAEnvironmentAMatch.length).toBe(0);

    const prodDeploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentAEnvironmentBMatch.length).toBe(0);

    const prodDeploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBEnvironmentAMatch.length).toBe(0);

    const prodDeploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-prod`,
      ) ?? [];
    expect(prodDeploymentBEnvironmentBMatch.length).toBe(0);

    const qaDeploymentAEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAEnvironmentAMatch.length).toBe(0);

    const qaDeploymentAEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-a` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentAEnvironmentBMatch.length).toBe(0);

    const qaDeploymentBEnvironmentAMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-a` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBEnvironmentAMatch.length).toBe(0);

    const qaDeploymentBEnvironmentBMatch =
      releaseTargets?.filter(
        (rt) =>
          rt.deployment.slug === `${systemPrefix}-deployment-b` &&
          rt.environment.name === `${systemPrefix}-b` &&
          rt.resource.identifier === `${systemPrefix}-qa`,
      ) ?? [];
    expect(qaDeploymentBEnvironmentBMatch.length).toBe(1);
  });

  test("should match a preexisting policy to a newly created resource", async ({
    api,
    workspace,
    page,
  }) => {
    const { id: workspaceId } = workspace;

    const prefix = faker.string.alphanumeric(10);

    const environment = await api.POST("/v1/environments", {
      body: {
        name: prefix,
        systemId: builder.refs.system.id,
        resourceSelector: {
          type: "identifier",
          operator: "equals",
          value: prefix,
        },
      },
    });

    expect(environment.response.status).toBe(200);

    const deployment = await api.POST("/v1/deployments", {
      body: {
        name: prefix,
        slug: prefix,
        systemId: builder.refs.system.id,
      },
    });

    expect(deployment.response.status).toBe(201);

    const deploymentVersion1 = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.data?.id ?? "",
        tag: "0.0.0",
        config: {},
        metadata: {
          env: prefix,
        },
      },
    });

    expect(deploymentVersion1.response.status).toBe(201);

    const deploymentVersion2 = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deployment.data?.id ?? "",
        tag: "1.0.0",
        config: {},
        metadata: {
          env: prefix,
        },
      },
    });

    expect(deploymentVersion2.response.status).toBe(201);

    const policy = await api.POST("/v1/policies", {
      body: {
        name: prefix,
        description: "Test Policy Description",
        workspaceId,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: prefix,
            },
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: prefix,
            },
          },
        ],
        deploymentVersionSelector: {
          name: "deploymentVersion",
          deploymentVersionSelector: {
            type: "tag",
            operator: "equals",
            value: "0.0.0",
          },
        },
      },
    });

    expect(policy.response.status).toBe(200);

    const resource = await api.POST("/v1/resources", {
      body: {
        name: prefix,
        kind: "service",
        identifier: prefix,
        version: "1.0.0",
        config: {},
        metadata: {
          env: prefix,
        },
        workspaceId,
      },
    });

    expect(resource.response.status).toBe(200);

    await page.waitForTimeout(10_000);

    const releaseTargetsResponse = await api.GET(
      "/v1/policies/{policyId}/release-targets",
      { params: { path: { policyId: policy.data?.id ?? "" } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data?.releaseTargets;

    expect(releaseTargets).toBeDefined();
    expect(releaseTargets?.length).toBe(1);

    const releaseTarget = releaseTargets?.[0];
    expect(releaseTarget).toBeDefined();
    expect(releaseTarget?.resource.identifier).toBe(prefix);
    expect(releaseTarget?.environment.name).toBe(prefix);
    expect(releaseTarget?.deployment.slug).toBe(prefix);

    const releases = await api.GET(
      "/v1/release-targets/{releaseTargetId}/releases",
      { params: { path: { releaseTargetId: releaseTarget?.id ?? "" } } },
    );

    expect(releases.response.status).toBe(200);
    const releasesData = releases.data;
    expect(releasesData).toBeDefined();
    expect(releasesData?.length).toBe(1);

    const release = releasesData?.[0];
    expect(release).toBeDefined();
    expect(release?.version.tag).toBe("0.0.0");
  });
});
