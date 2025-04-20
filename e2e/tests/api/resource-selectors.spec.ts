import { expect } from "@playwright/test";
import _ from "lodash";

import { createExampleSystem, ExampleSystem } from "../../api/utils";
import { test } from "../fixtures";

test.describe("Resource Selectors API", () => {
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

  test("get qa environment resources", async ({ page, api }) => {
    await page.waitForTimeout(5_000);
    const releaseTargets = await api.GET(
      `/v1/environments/{environmentId}/resources`,
      {
        params: { path: { environmentId: environments.qa.id } },
      },
    );

    expect(releaseTargets.response.status).toBe(200);
    expect(releaseTargets.data?.resources?.length).toBe(resources.qa.length);
  });

  test("get prod environment resources", async ({ page, api }) => {
    await page.waitForTimeout(5_000);
    const releaseTargets = await api.GET(
      `/v1/environments/{environmentId}/resources`,
      {
        params: { path: { environmentId: environments.prod.id } },
      },
    );

    expect(releaseTargets.response.status).toBe(200);
    expect(releaseTargets.data?.resources?.length).toBe(resources.prod.length);
  });
});
