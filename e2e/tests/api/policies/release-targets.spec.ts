import { expect } from "@playwright/test";
import _ from "lodash";

import { test } from "../../fixtures";

test.describe("Release Targets API", () => {
  let system: ExampleSystem["system"];
  let resources: ExampleSystem["resources"];
  let environments: ExampleSystem["environments"];
  let deployments: ExampleSystem["deployments"];

  test.beforeAll(async ({ api, workspace }) => {
    const example = await createExampleSystem(api, workspace.id);
    system = example.system;
    resources = example.resources;
    environments = example.environments;
    deployments = example.deployments;
  });

  test("create policy with environment selector target", async ({
    page,
    api,
    workspace,
  }) => {
    const policyTarget = await api.POST("/v1/policies", {
      body: {
        name: system.name + "-environment-selector-policy",
        workspaceId: workspace.id,
        targets: [
          {
            environmentSelector: {
              type: "comparison",
              operator: "and",
              conditions: [
                {
                  type: "system",
                  operator: "equals",
                  value: system.id,
                },
                {
                  type: "metadata",
                  operator: "equals",
                  key: "env",
                  value: "qa",
                },
              ],
            },
          },
        ],
      },
    });

    expect(policyTarget.response.status).toBe(200);
    expect(policyTarget.data?.enabled).toEqual(true);

    // Wait for the release targets to be computed, should take no more than 1
    // seconds. If it takes longer, we'll fail the test. Increase worker pods
    // if this becomes an issue.
    await page.waitForTimeout(29_000);

    const releaseTargets = await api.GET(
      `/v1/policies/{policyId}/release-targets`,
      {
        params: {
          path: { policyId: policyTarget.data?.id ?? "" },
        },
      },
    );

    expect(releaseTargets.response.status).toBe(200);
    expect(
      _.uniq(
        releaseTargets.data?.releaseTargets?.map((rt) => rt.environment?.id),
      ),
    ).toEqual([environments.qa.id]);

    expect(releaseTargets.data?.count).toBe(
      resources.qa.length * 2, // 2 deployments apply to qa
    );
  });
});
