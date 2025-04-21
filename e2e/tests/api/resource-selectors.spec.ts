import path from "path";
import { expect } from "@playwright/test";
import _ from "lodash";

import { ImportedEntities, importEntitiesFromYaml } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "resource-selectors.spec.yaml");

test.describe("Resource Selectors API", () => {
  let importedEntities: ImportedEntities;
  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
    // wait for resources to be processed
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  });

  test("basic environment resource selector", async ({ page, api }) => {
    const environment = importedEntities.environments.find(
      (env) => env.name === "Production",
    )!;
    const releaseTargets = await api.GET(
      `/v1/environments/{environmentId}/resources`,
      {
        params: {
          path: { environmentId: environment.id },
        },
      },
    );

    const resources = importedEntities.resources.filter(
      (resource) => resource.metadata?.env === "prod",
    );

    expect(releaseTargets.response.status).toBe(200);
    expect(releaseTargets.data?.resources?.length).toBe(resources.length);
  });

  test("basic deployment resource selector", async ({ page, api }) => {
    const deployment = importedEntities.deployments.find(
      (deployment) => deployment.slug === "selector-deployment",
    )!;
    const res = await api.GET(`/v1/deployments/{deploymentId}/resources`, {
      params: {
        path: {
          deploymentId: deployment.id,
        },
      },
    });

    expect(res.response.status).toBe(200);
    const resources = importedEntities.resources.filter(
      (resource) => resource.metadata?.env === "prod",
    );
    expect(res.data?.count).toBe(resources.length);
  });
});
