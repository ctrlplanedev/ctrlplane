import path from "path";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "job-flow-entities.spec.yaml");

test.describe("Deployment Versions API", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
    await builder.createSystem();
    await builder.createResources();
    await builder.createEnvironments();
    await builder.createDeployments();
    await builder.createAgents();
    await builder.createDeploymentVersions();
    await new Promise((resolve) => setTimeout(resolve, 5000));
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.cache, workspace.id);
  });

  test("should create a deployment version", async ({ api }) => {
    const agentId = builder.cache.agents[0].id;
    const jobQueueResponse = await api.GET(
      "/v1/job-agents/{agentId}/queue/next",
      {
        params: {
          path: {
            agentId,
          },
        },
      },
    );

    expect(jobQueueResponse.response.status).toBe(200);
  });
});
