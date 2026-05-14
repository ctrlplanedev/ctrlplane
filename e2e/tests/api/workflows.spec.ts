import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { test } from "../fixtures";

const slugifyWorkflowName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

test.describe("Workflow API", () => {
  test("should create a workflow and derive the slug from the name", async ({
    api,
    workspace,
  }) => {
    const name = `Workflow ${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, inputs: [], jobAgents: [] },
      },
    );

    expect(createRes.response.status).toBe(201);
    expect(createRes.data!.name).toBe(name);
    expect(createRes.data!.slug).toBe(slugifyWorkflowName(name));

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      {
        params: {
          path: { workspaceId: workspace.id, workflowId: createRes.data!.id },
        },
      },
    );
  });

  test("should create a workflow with an explicit slug", async ({
    api,
    workspace,
  }) => {
    const name = `Workflow ${faker.string.alphanumeric(8)}`;
    const slug = `wf-${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, slug, inputs: [], jobAgents: [] },
      },
    );

    expect(createRes.response.status).toBe(201);
    expect(createRes.data!.slug).toBe(slug);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      {
        params: {
          path: { workspaceId: workspace.id, workflowId: createRes.data!.id },
        },
      },
    );
  });

  test("should return the slug when fetching a workflow", async ({
    api,
    workspace,
  }) => {
    const name = `Get Slug ${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(201);
    const workflowId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      {
        params: { path: { workspaceId: workspace.id, workflowId } },
      },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.id).toBe(workflowId);
    expect(getRes.data!.slug).toBe(slugifyWorkflowName(name));

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
  });

  test("should include the slug when listing workflows", async ({
    api,
    workspace,
  }) => {
    const name = `List Slug ${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(201);
    const workflowId = createRes.data!.id;

    const listRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
      },
    );

    expect(listRes.response.status).toBe(200);
    const listed = listRes.data!.items.find((w) => w.id === workflowId);
    expect(listed).toBeDefined();
    expect(listed!.slug).toBe(slugifyWorkflowName(name));

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
  });

  test("should allow updating a workflow's slug", async ({
    api,
    workspace,
  }) => {
    const name = `Update Slug ${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(201);
    const workflowId = createRes.data!.id;

    const newSlug = `renamed-${faker.string.alphanumeric(8)}`;
    const updateRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      {
        params: { path: { workspaceId: workspace.id, workflowId } },
        body: { name, slug: newSlug, inputs: [], jobAgents: [] },
      },
    );

    expect(updateRes.response.status).toBe(202);
    expect(updateRes.data!.slug).toBe(newSlug);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
    expect(getRes.data!.slug).toBe(newSlug);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
  });

  test("should delete a workflow", async ({ api, workspace }) => {
    const name = `Delete ${faker.string.alphanumeric(8)}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(201);
    const workflowId = createRes.data!.id;

    const deleteRes = await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
    expect(deleteRes.response.status).toBe(202);

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
    expect(getRes.response.status).toBe(404);
  });
});
