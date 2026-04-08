import { expect } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";

import { test } from "../fixtures";

test.describe("Deployment API", () => {
  let systemId: string;
  let jobAgentId: string;

  test.beforeAll(async ({ api, workspace }) => {
    const systemRes = await api.POST(
      "/v1/workspaces/{workspaceId}/systems",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `test-system-${faker.string.alphanumeric(8)}`,
        },
      },
    );
    expect(systemRes.response.status).toBe(202);
    systemId = systemRes.data!.id;

    jobAgentId = uuidv4();
    const agentRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
      {
        params: {
          path: { workspaceId: workspace.id, jobAgentId },
        },
        body: {
          name: `test-agent-${faker.string.alphanumeric(8)}`,
          type: "test-runner",
          config: {},
        },
      },
    );
    expect(agentRes.response.status).toBe(202);
  });

  test.afterAll(async ({ api, workspace }) => {
    await api.DELETE("/v1/workspaces/{workspaceId}/systems/{systemId}", {
      params: { path: { workspaceId: workspace.id, systemId } },
    });
  });

  test("should create a deployment and retrieve it", async ({
    api,
    workspace,
  }) => {
    const name = `deploy-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, slug: name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    // Link to system
    await api.PUT(
      "/v1/workspaces/{workspaceId}/systems/{systemId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, systemId, deploymentId },
        },
      },
    );

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.deployment.id).toBe(deploymentId);
    expect(getRes.data!.deployment.name).toBe(name);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should create a deployment with a job agent selector", async ({
    api,
    workspace,
  }) => {
    const name = `deploy-agent-${faker.string.alphanumeric(8)}`;
    const selector = `jobAgent.id == "${jobAgentId}"`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name,
          slug: name,
          jobAgentSelector: selector,
          jobAgentConfig: { repo: "my-repo" },
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    const { deployment } = getRes.data!;
    expect(deployment.jobAgentSelector).toBe(selector);
    expect(deployment.jobAgentConfig).toEqual({ repo: "my-repo" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should upsert a deployment with a job agent selector", async ({
    api,
    workspace,
  }) => {
    const deploymentId = uuidv4();
    const name = `deploy-upsert-${faker.string.alphanumeric(8)}`;
    const selector = `jobAgent.id == "${jobAgentId}"`;

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
        body: {
          name,
          slug: name,
          resourceSelector: "false",
          jobAgentSelector: selector,
          jobAgentConfig: { workflow: "deploy.yaml" },
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    const { deployment } = getRes.data!;
    expect(deployment.name).toBe(name);
    expect(deployment.jobAgentSelector).toBe(selector);
    expect(deployment.jobAgentConfig).toEqual({ workflow: "deploy.yaml" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should create a deployment with a custom jobAgentSelector", async ({
    api,
    workspace,
  }) => {
    const name = `deploy-selector-${faker.string.alphanumeric(8)}`;
    const selector = `jobAgent.type == "test-runner"`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name,
          slug: name,
          jobAgentSelector: selector,
          jobAgentConfig: { workflow: "ci.yaml" },
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    const { deployment } = getRes.data!;
    expect(deployment.jobAgentSelector).toBe(selector);
    expect(deployment.jobAgentConfig).toEqual({ workflow: "ci.yaml" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should create deployment with jobAgentSelector and jobAgentConfig", async ({
    api,
    workspace,
  }) => {
    const name = `deploy-default-sel-${faker.string.alphanumeric(8)}`;
    const selector = `jobAgent.id == "${jobAgentId}"`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name,
          slug: name,
          jobAgentSelector: selector,
          jobAgentConfig: { image: "app:latest" },
        },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    const { deployment } = getRes.data!;
    expect(deployment.jobAgentSelector).toBe(selector);
    expect(deployment.jobAgentConfig).toEqual({ image: "app:latest" });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should upsert a deployment with a custom jobAgentSelector", async ({
    api,
    workspace,
  }) => {
    const deploymentId = uuidv4();
    const name = `deploy-upsert-sel-${faker.string.alphanumeric(8)}`;
    const selector = `jobAgent.name == "my-agent"`;

    const upsertRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
        body: {
          name,
          slug: name,
          jobAgentSelector: selector,
          jobAgentConfig: { env: "staging" },
        },
      },
    );

    expect(upsertRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(200);
    const { deployment } = getRes.data!;
    expect(deployment.jobAgentSelector).toBe(selector);
    expect(deployment.jobAgentConfig).toEqual({ env: "staging" });

    // Update the selector via upsert
    const updatedSelector = `jobAgent.type == "kubernetes"`;
    await api.PUT(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
        body: {
          name,
          slug: name,
          jobAgentSelector: updatedSelector,
          jobAgentConfig: { env: "production" },
        },
      },
    );

    const getRes2 = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes2.response.status).toBe(200);
    expect(getRes2.data!.deployment.jobAgentSelector).toBe(updatedSelector);
    expect(getRes2.data!.deployment.jobAgentConfig).toEqual({
      env: "production",
    });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });

  test("should delete a deployment", async ({ api, workspace }) => {
    const name = `deploy-delete-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, slug: name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(deleteRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      {
        params: {
          path: { workspaceId: workspace.id, deploymentId },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should list deployments", async ({ api, workspace }) => {
    const name = `deploy-list-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, slug: name },
      },
    );

    expect(createRes.response.status).toBe(202);
    const deploymentId = createRes.data!.id;

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/deployments",
      {
        params: { path: { workspaceId: workspace.id } },
      },
    );

    expect(listRes.response.status).toBe(200);
    const items = listRes.data!.items;
    expect(items.some((d) => d.deployment.id === deploymentId)).toBe(true);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
      { params: { path: { workspaceId: workspace.id, deploymentId } } },
    );
  });
});
