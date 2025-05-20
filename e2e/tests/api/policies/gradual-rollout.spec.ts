import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../../api";
import { test } from "../../fixtures";

const TEN_MINUTES = 10 * 60 * 1_000;

const yamlPath = path.join(__dirname, "gradual-rollout.spec.yaml");

test.describe("Gradual Rollout", () => {
  let importedEntities: ImportedEntities;
  test.setTimeout(TEN_MINUTES);

  test.beforeAll(async ({ api, workspace }) => {
    importedEntities = await importEntitiesFromYaml(
      api,
      workspace.id,
      yamlPath,
    );

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, importedEntities, workspace.id);
  });

  test("should create a gradual rollout policy", async ({
    api,
    workspace,
    page,
  }) => {
    const { system } = importedEntities;

    const deploymentSlug = faker.string.alphanumeric(10);

    const deploymentResponse = await api.POST("/v1/deployments", {
      body: {
        systemId: system.id,
        name: "Gradual Rollout Deployment",
        slug: deploymentSlug,
        description: "Gradual Rollout Deployment",
      },
    });
    expect(deploymentResponse.response.status).toBe(201);

    const policyResponse = await api.POST("/v1/policies", {
      body: {
        name: faker.string.alphanumeric(10),
        workspaceId: workspace.id,
        targets: [
          {
            deploymentSelector: {
              type: "slug",
              operator: "equals",
              value: deploymentSlug,
            },
          },
        ],
        gradualRollout: {
          deployRate: 1,
          windowSizeMinutes: 1,
          name: faker.string.alphanumeric(10),
        },
      },
    });
    expect(policyResponse.response.status).toBe(200);

    const versionTag = faker.string.alphanumeric(10);
    const versionResponse = await api.POST("/v1/deployment-versions", {
      body: {
        deploymentId: deploymentResponse.data?.id ?? "",
        tag: versionTag,
      },
    });
    expect(versionResponse.response.status).toBe(201);

    await page.waitForTimeout(1_000);

    let expectedReleaseTargets = 1;

    for (let i = 0; i < 5; i++) {
      const releaseResponse = await api.GET(
        `/v1/deployment-versions/{deploymentVersionId}/releases`,
        {
          params: {
            path: {
              deploymentVersionId: versionResponse.data?.id ?? "",
            },
          },
        },
      );
      expect(releaseResponse.response.status).toBe(200);
      expect(releaseResponse.data?.length).toBe(expectedReleaseTargets);
      expectedReleaseTargets++;

      await page.waitForTimeout(60_000);
    }
  });
});
