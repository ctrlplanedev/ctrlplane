import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { addMinutes, differenceInMilliseconds, startOfMinute } from "date-fns";

import { cleanupImportedEntities, EntitiesBuilder } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(
  __dirname,
  "environment-version-rollout-policy.spec.yaml",
);

test.describe("Environment Version Rollout Policy", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    await builder.upsertSystemFixture();
    await builder.upsertResourcesFixtures();
    await builder.upsertEnvironmentFixtures();
    await builder.upsertDeploymentFixtures();

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should rollout versions in a linear fashion", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-linear-rollout`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-linear-rollout`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-linear-rollout`,
        description: "Linear rollout policy",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-linear-rollout`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "linear",
          timeScaleInterval,
        },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe("linear");

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    const expectedRolloutStart = startOfMinute(
      new Date(deploymentVersion.createdAt),
    );

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      const expectedRolloutTime = addMinutes(
        expectedRolloutStart,
        timeScaleInterval * i,
      );
      expect(releaseTarget.rolloutTime).toBeDefined();
      const receivedRolloutTime = new Date(releaseTarget.rolloutTime!);

      const diff = differenceInMilliseconds(
        receivedRolloutTime,
        expectedRolloutTime,
      );

      expect(diff).toBeLessThan(50);
    }
  });

  test("should rollout versions in a linear normalized fashion", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-linear-rollout-normalized`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-linear-rollout-normalized`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-linear-rollout-normalized`,
        description: "Linear normalized rollout policy",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-linear-rollout-normalized`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "linear-normalized",
          timeScaleInterval,
        },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe("linear_normalized");

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    const expectedRolloutStart = startOfMinute(
      new Date(deploymentVersion.createdAt),
    );

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      const expectedRolloutTime = addMinutes(
        expectedRolloutStart,
        (timeScaleInterval / releaseTargetsWithRolloutInfo.length) * i,
      );

      expect(releaseTarget.rolloutTime).toBeDefined();
      const receivedRolloutTime = new Date(releaseTarget.rolloutTime!);

      const diff = differenceInMilliseconds(
        receivedRolloutTime,
        expectedRolloutTime,
      );

      expect(diff).toBeLessThan(50);
    }
  });

  test("should rollout versions in a exponential fashion", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-exponential-rollout`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-exponential-rollout`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const positionGrowthFactor = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-exponential-rollout`,
        description: "Exponential rollout policy",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-exponential-rollout`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "exponential",
          timeScaleInterval,
          positionGrowthFactor,
        },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe("exponential");

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    const expectedRolloutStart = startOfMinute(
      new Date(deploymentVersion.createdAt),
    );

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      const expectedRolloutTime = addMinutes(
        expectedRolloutStart,
        timeScaleInterval * (1 - Math.exp(-i / positionGrowthFactor)),
      );

      expect(releaseTarget.rolloutTime).toBeDefined();
      const receivedRolloutTime = new Date(releaseTarget.rolloutTime!);

      const diff = differenceInMilliseconds(
        receivedRolloutTime,
        expectedRolloutTime,
      );

      expect(diff).toBeLessThan(50);
    }
  });

  test("should rollout versions in a exponential normalized fashion", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-exponential-rollout-normalized`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-exponential-rollout-normalized`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const positionGrowthFactor = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-exponential-rollout-normalized`,
        description: "Exponential normalized rollout policy",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-exponential-rollout-normalized`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "exponential-normalized",
          timeScaleInterval,
          positionGrowthFactor,
        },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe(
      "exponential_normalized",
    );

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    const expectedRolloutStart = startOfMinute(
      new Date(deploymentVersion.createdAt),
    );

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      const numReleaseTargets = releaseTargetsWithRolloutInfo.length;
      const expectedRolloutTime = addMinutes(
        expectedRolloutStart,
        timeScaleInterval *
          ((1 - Math.exp(-i / numReleaseTargets)) /
            (1 - Math.exp(-numReleaseTargets / positionGrowthFactor))),
      );

      expect(releaseTarget.rolloutTime).toBeDefined();
      const receivedRolloutTime = new Date(releaseTarget.rolloutTime!);

      const diff = differenceInMilliseconds(
        receivedRolloutTime,
        expectedRolloutTime,
      );

      expect(diff).toBeLessThan(50);
    }
  });

  test("rollout times should be null if policy requires approvals and the deployment version has no approvals", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-no-approvals`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-no-approvals`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-no-approvals`,
        description: "No approvals rollout policy",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-no-approvals`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "linear",
          timeScaleInterval,
        },
        versionAnyApprovals: { requiredApprovalsCount: 1 },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe("linear");

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      expect(releaseTarget.rolloutTime).toBeNull();
    }
  });

  test("should rollout versions in a linear fashion with start time being the latest approval time", async ({
    api,
    workspace,
    page,
  }) => {
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-linear-rollout-with-approvals`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-linear-rollout-with-approvals`,
    )!;

    const timeScaleInterval = faker.number.float({ min: 1, max: 100 });
    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: `${prefix}-linear-rollout-with-approvals`,
        description: "Linear rollout policy with approvals",
        priority: 1,
        enabled: true,
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "name",
              operator: "equals",
              value: `${prefix}-linear-rollout-with-approvals`,
            },
          },
        ],
        environmentVersionRollout: {
          rolloutType: "linear",
          timeScaleInterval,
        },
        versionAnyApprovals: { requiredApprovalsCount: 1 },
      },
    });
    expect(policyResponse.response.status).toBe(200);
    expect(policyResponse.data).toBeDefined();
    const policy = policyResponse.data!;
    expect(policy.environmentVersionRollout).toBeDefined();
    const environmentVersionRollout = policy.environmentVersionRollout!;
    expect(environmentVersionRollout.rolloutType).toBe("linear");

    const deploymentVersionResponse = await api.POST(
      "/v1/deployment-versions",
      {
        body: {
          deploymentId: deployment.id,
          tag: faker.string.alphanumeric(10),
        },
      },
    );

    expect(deploymentVersionResponse.response.status).toBe(201);
    expect(deploymentVersionResponse.data).toBeDefined();
    const deploymentVersion = deploymentVersionResponse.data!;

    const tenMinutesFromNow = addMinutes(new Date(), 10);
    const approvalResponse = await api.POST(
      "/v1/deployment-versions/{deploymentVersionId}/approve",
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
          },
        },
        body: { approvedAt: tenMinutesFromNow.toISOString() },
      },
    );
    expect(approvalResponse.response.status).toBe(200);

    await page.waitForTimeout(5_000);

    const rolloutResponse = await api.GET(
      `/v1/deployment-versions/{deploymentVersionId}/environments/{environmentId}/rollout`,
      {
        params: {
          path: {
            deploymentVersionId: deploymentVersion.id,
            environmentId: environment.id,
          },
        },
      },
    );

    expect(rolloutResponse.response.status).toBe(200);
    const releaseTargetsWithRolloutInfo = rolloutResponse.data ?? [];
    expect(releaseTargetsWithRolloutInfo).toHaveLength(4);

    const expectedRolloutStart = startOfMinute(tenMinutesFromNow);

    for (let i = 0; i < releaseTargetsWithRolloutInfo.length; i++) {
      const releaseTarget = releaseTargetsWithRolloutInfo[i];
      const expectedRolloutTime = addMinutes(
        expectedRolloutStart,
        timeScaleInterval * i,
      );

      expect(releaseTarget.rolloutTime).toBeDefined();
      const receivedRolloutTime = new Date(releaseTarget.rolloutTime!);

      const diff = differenceInMilliseconds(
        receivedRolloutTime,
        expectedRolloutTime,
      );

      expect(diff).toBeLessThan(50);
    }
  });
});
