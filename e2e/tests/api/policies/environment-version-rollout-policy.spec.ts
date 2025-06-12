import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import { addMinutes, startOfMinute } from "date-fns";

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

    await builder.upsertSystem();
    await builder.upsertResources();
    await builder.upsertEnvironments();
    await builder.upsertDeployments();

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("should rollout versions in a linear fashion", async ({
    api,
    workspace,
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

      expect(releaseTarget.rolloutTime).toBe(expectedRolloutTime.toISOString());
      expect(Number(releaseTarget.rolloutPosition)).toBe(i);
    }
  });

  test("should rollout versions in a linear normalized fashion", async ({
    api,
    workspace,
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
    expect(environmentVersionRollout.rolloutType).toBe("linear-normalized");

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

      expect(releaseTarget.rolloutTime).toBe(expectedRolloutTime.toISOString());
      expect(Number(releaseTarget.rolloutPosition)).toBe(i);
    }
  });

  test("should rollout versions in a exponential fashion", async ({
    api,
    workspace,
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

      expect(releaseTarget.rolloutTime).toBe(expectedRolloutTime.toISOString());
      expect(Number(releaseTarget.rolloutPosition)).toBeCloseTo(i, 4);
    }
  });

  test("should rollout versions in a exponential normalized fashion", async ({
    api,
    workspace,
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
      "exponential-normalized",
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

      expect(releaseTarget.rolloutTime).toBe(expectedRolloutTime.toISOString());
      expect(Number(releaseTarget.rolloutPosition)).toBeCloseTo(i, 4);
    }
  });
});
