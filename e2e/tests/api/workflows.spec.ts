import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import type { components } from "../../api/schema";
import { test } from "../fixtures";

type WorkflowSlugConflict = components["schemas"]["WorkflowSlugConflictResponse"];

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
    const slug = `wf-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
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

    const newSlug = `renamed-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
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

  test("should get a workflow by slug", async ({ api, workspace }) => {
    const name = `By Slug ${faker.string.alphanumeric(8)}`;
    const slug = `by-slug-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name, slug, inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(201);
    const workflowId = createRes.data!.id;

    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows/slug/{slug}",
      { params: { path: { workspaceId: workspace.id, slug } } },
    );

    expect(getRes.response.status).toBe(200);
    expect(getRes.data!.id).toBe(workflowId);
    expect(getRes.data!.slug).toBe(slug);

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId } } },
    );
  });

  test("should return 404 when getting a workflow by a non-existent slug", async ({
    api,
    workspace,
  }) => {
    const getRes = await api.GET(
      "/v1/workspaces/{workspaceId}/workflows/slug/{slug}",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            slug: `missing-${faker.string.alphanumeric(12)}`,
          },
        },
      },
    );

    expect(getRes.response.status).toBe(404);
  });

  test("should reject creating a workflow with a duplicate slug in the same workspace", async ({
    api,
    workspace,
  }) => {
    const slug = `dup-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
    const firstRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `First ${faker.string.alphanumeric(8)}`,
          slug,
          inputs: [],
          jobAgents: [],
        },
      },
    );
    expect(firstRes.response.status).toBe(201);
    const firstId = firstRes.data!.id;

    const dupRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `Second ${faker.string.alphanumeric(8)}`,
          slug,
          inputs: [],
          jobAgents: [],
        },
      },
    );
    expect(dupRes.response.status).toBe(409);
    const dupErr = dupRes.error as WorkflowSlugConflict;
    expect(dupErr.code).toBe("DUPLICATE_SLUG");
    expect(dupErr.details).toMatchObject({
      slug,
      existingWorkflowId: firstId,
    });

    await api.DELETE(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      { params: { path: { workspaceId: workspace.id, workflowId: firstId } } },
    );
  });

  test("should reject updating a workflow to a duplicate slug in the same workspace", async ({
    api,
    workspace,
  }) => {
    const slugA = `dup-upd-a-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;
    const slugB = `dup-upd-b-${faker.string.alphanumeric({ length: 8, casing: "lower" })}`;

    const [resA, resB] = await Promise.all([
      api.POST("/v1/workspaces/{workspaceId}/workflows", {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `A ${faker.string.alphanumeric(8)}`,
          slug: slugA,
          inputs: [],
          jobAgents: [],
        },
      }),
      api.POST("/v1/workspaces/{workspaceId}/workflows", {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `B ${faker.string.alphanumeric(8)}`,
          slug: slugB,
          inputs: [],
          jobAgents: [],
        },
      }),
    ]);
    expect(resA.response.status).toBe(201);
    expect(resB.response.status).toBe(201);
    const idA = resA.data!.id;
    const idB = resB.data!.id;

    const renameRes = await api.PUT(
      "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
      {
        params: { path: { workspaceId: workspace.id, workflowId: idB } },
        body: {
          name: `B renamed`,
          slug: slugA,
          inputs: [],
          jobAgents: [],
        },
      },
    );
    expect(renameRes.response.status).toBe(409);
    const renameErr = renameRes.error as WorkflowSlugConflict;
    expect(renameErr.code).toBe("DUPLICATE_SLUG");
    expect(renameErr.details).toMatchObject({
      slug: slugA,
      existingWorkflowId: idA,
    });

    await Promise.all([
      api.DELETE("/v1/workspaces/{workspaceId}/workflows/{workflowId}", {
        params: { path: { workspaceId: workspace.id, workflowId: idA } },
      }),
      api.DELETE("/v1/workspaces/{workspaceId}/workflows/{workflowId}", {
        params: { path: { workspaceId: workspace.id, workflowId: idB } },
      }),
    ]);
  });

  test("should reject creating a workflow with an invalid slug", async ({
    api,
    workspace,
  }) => {
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: {
          name: `Invalid ${faker.string.alphanumeric(8)}`,
          slug: "Not A Valid Slug!",
          inputs: [],
          jobAgents: [],
        },
      },
    );
    expect(createRes.response.status).toBe(400);
  });

  test("should reject creating a workflow when the name slugifies to an empty string", async ({
    api,
    workspace,
  }) => {
    const createRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows",
      {
        params: { path: { workspaceId: workspace.id } },
        body: { name: "!!!", inputs: [], jobAgents: [] },
      },
    );
    expect(createRes.response.status).toBe(400);
  });

  test("should return 404 when running a workflow by a non-existent slug", async ({
    api,
    workspace,
  }) => {
    const runRes = await api.POST(
      "/v1/workspaces/{workspaceId}/workflows/slug/{slug}/runs",
      {
        params: {
          path: {
            workspaceId: workspace.id,
            slug: `missing-${faker.string.alphanumeric(12)}`,
          },
        },
        body: { inputs: {} },
      },
    );
    expect(runRes.response.status).toBe(404);
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
