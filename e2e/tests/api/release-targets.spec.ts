import path from "path";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "release-targets.spec.yaml");

test.describe("Release Targets API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.createSystem();
    await builder.createResources();
    await builder.createEnvironments();
    await builder.createDeployments();
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.cache, workspace.id);
  });

  test("should fetch release targets for a resource", async ({api,page,workspace,}) => {
    await page.waitForTimeout(5_000);
    const importedResource = builder.cache.resources.at(0);
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
    const environmentMatch = builder.cache.environments.find(
      (e) => e.id === releaseTarget.environment.id,
    );
    expect(environmentMatch).toBeDefined();
    if (!environmentMatch) throw new Error("No environment match found");

    const deploymentMatch = builder.cache.deployments.find(
      (d) => d.id === releaseTarget.deployment.id,
    );
    expect(deploymentMatch).toBeDefined();
    if (!deploymentMatch) throw new Error("No deployment match found");
  });
});
