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

    await builder.upsertPolicies();
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
    const { id: workspaceId } = workspace;
    const { prefix } = builder.refs;

    const deployment = builder.refs.deployments.find(
      (d) => d.name === `${prefix}-linear-rollout-no-approval`,
    )!;

    const environment = builder.refs.environments.find(
      (e) => e.name === `${prefix}-linear-rollout-no-approval`,
    )!;

    const policyRef = builder.refs.policies.find(
      (p) => p.name === `${prefix}-linear-rollout-no-approval`,
    )!;
    const policyResponse = await api.GET("/v1/policies/{policyId}", {
      params: {
        path: {
          policyId: policyRef.id,
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
        environmentVersionRollout.timeScaleInterval * i,
      );

      expect(releaseTarget.rolloutTime).toBe(expectedRolloutTime);
      expect(releaseTarget.rolloutPosition).toBe(i);
    }
  });
});
