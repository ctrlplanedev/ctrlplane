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
  });

  test("get qa environment resources", async ({ page, api }) => {
    await page.waitForTimeout(5_000);
    const releaseTargets = await api.GET(
      `/v1/environments/{environmentId}/resources`,
      {
        params: {
          path: { environmentId: importedEntities.environments[0].id },
        },
      },
    );

    expect(releaseTargets.response.status).toBe(200);
    expect(releaseTargets.data?.resources?.length).toBe(
      importedEntities.resources.length,
    );
  });

  test("get prod environment resources", async ({ page, api }) => {
    await page.waitForTimeout(5_000);
    const res = await api.GET(`/v1/environments/{environmentId}/resources`, {
      params: {
        path: { environmentId: importedEntities.environments[1].id },
      },
    });

    expect(res.response.status).toBe(200);
    expect(res.data?.resources?.length).toBe(importedEntities.resources.length);
  });

  test("get deployment resources", async ({ page, api }) => {
    await page.waitForTimeout(5_000);
    const res = await api.GET(`/v1/deployments/{deploymentId}/resources`, {
      params: {
        path: {
          deploymentId: importedEntities.deployments[0].id,
        },
      },
    });

    expect(res.response.status).toBe(200);
    expect(res.data?.count).toBe(importedEntities.resources.length);
  });
});
