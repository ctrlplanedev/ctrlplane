import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import {
  cleanupImportedEntities,
  ImportedEntities,
  importEntitiesFromYaml,
} from "../../api";
import { test } from "../fixtures";

const yamlPath = path.join(__dirname, "job-agents.spec.yaml");

test.describe("Job Agent API", () => {
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

  test("create a job agent", async ({ api, workspace }) => {
    const agentName = `e2e-test-agent-${faker.string.alphanumeric(8)}`;
    const response = await api.PATCH("/v1/job-agents/name", {
      body: {
        workspaceId: workspace.id,
        name: agentName,
        type: "kubernetes",
      },
    });

    expect(response.response.status).toBe(200);
    expect(response.data?.id).toBeDefined();
    expect(response.error).toBeUndefined();
    expect(response.data?.workspaceId).toBe(workspace.id);
    expect(response.data?.name).toBe(agentName);
  });

  test("update a job agent", async ({ api, workspace }) => {
    // First create a job agent
    const agentName = `e2e-test-agent-${faker.string.alphanumeric(8)}`;
    const createResponse = await api.PATCH("/v1/job-agents/name", {
      body: {
        workspaceId: workspace.id,
        name: agentName,
        type: "kubernetes",
      },
    });

    expect(createResponse.response.status).toBe(200);
    const agentId = createResponse.data?.id;
    expect(agentId).toBeDefined();

    // Update the job agent with a new name
    const updatedAgentName = `e2e-test-agent-updated-${faker.string.alphanumeric(8)}`;
    const updateResponse = await api.PATCH("/v1/job-agents/name", {
      body: {
        workspaceId: workspace.id,
        name: updatedAgentName,
        type: "kubernetes",
      },
    });

    expect(updateResponse.response.status).toBe(200);
    expect(updateResponse.data?.name).toBe(updatedAgentName);
  });
});
