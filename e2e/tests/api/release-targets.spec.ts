import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release-targets.spec.yaml");

test.describe("Release Targets API", () => {
  let importedEntities: ImportedEntities;

  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("should fetch release targets for a resource", async ({
    api,
    page,
    workspace,
  }) => {
    await page.waitForTimeout(5_000);
    const importedResource = importedEntities.resources.at(0);
    expect(importedResource).toBeDefined();
    if (!importedResource) throw new Error("No resource found");

    const resourceResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            identifier: importedResource.identifier,
          },
        },
      },
    );
    expect(resourceResponse.response.status).toBe(200);
    const resourceId = resourceResponse.data?.id;
    expect(resourceId).toBeDefined();
    if (!resourceId) throw new Error("No resource ID found");

    const releaseTargetsResponse = await api.GET(
      "/v1/resources/{resourceId}/release-targets",
      { params: { path: { resourceId } } },
    );

    expect(releaseTargetsResponse.response.status).toBe(200);
    const releaseTargets = releaseTargetsResponse.data;
    expect(releaseTargets).toBeDefined();
    if (!releaseTargets) throw new Error("No release targets found");

    expect(releaseTargets.length).toBe(1);
    const [releaseTarget] = releaseTargets;
    expect(releaseTarget).toBeDefined();
    if (!releaseTarget) throw new Error("No release target found");

    expect(releaseTarget.resource.id).toBe(resourceId);
    const environmentMatch = importedEntities.environments.find(
      (e) => e.id === releaseTarget.environment.id,
    );
    expect(environmentMatch).toBeDefined();
    if (!environmentMatch) throw new Error("No environment match found");

    const deploymentMatch = importedEntities.deployments.find(
      (d) => d.id === releaseTarget.deployment.id,
    );
    expect(deploymentMatch).toBeDefined();
    if (!deploymentMatch) throw new Error("No deployment match found");
  });
});
