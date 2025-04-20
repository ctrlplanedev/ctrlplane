import { expect } from "@playwright/test";

import { createExampleSystem, ExampleSystem } from "../../../api/utils";
import { test } from "../../fixtures";

test.describe("Policy Targets API", () => {
  let system: ExampleSystem["system"];
  let resources: ExampleSystem["resources"];
  let environment: ExampleSystem["environment"];

  test.beforeAll(async ({ api, workspace }) => {
    const example = await createExampleSystem(api, workspace.id);
    system = example.system;
    resources = example.resources;
    environment = example.environment;
  });

  test("create policy", async ({ api, workspace }) => {
    const policyTarget = await api.POST("/v1/policies", {
      body: {
        name: system.name + "-base",
        workspaceId: workspace.id,
        enabled: false,
        targets: [],
      },
    });

    expect(policyTarget.response.status).toBe(200);
    expect(policyTarget.data?.id).toBeDefined();
    expect(policyTarget.data?.name).toBe(system.name + "-base");
    expect(policyTarget.data?.enabled).toBe(false);
  });

  test("create policy with environment selector target", async ({
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
              type: "metadata",
              operator: "equals",
              key: "env",
              value: "qa",
            },
          },
        ],
      },
    });

    expect(policyTarget.response.status).toBe(200);
    expect(policyTarget.data?.enabled).toEqual(true);
  });
});
