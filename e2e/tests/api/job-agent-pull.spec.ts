import { expect } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";

import { eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { ApiClient } from "../../api";
import { test } from "../fixtures";

// These tests cover the pull API (list + claim) in isolation: jobs are seeded
// directly into the database in a `queued` state rather than produced by the
// dispatch controller, so the assertions are about the API layer's retrieval
// and claiming behavior, not the engine.
test.describe("Job Agent Pull API", () => {
  const agentIds: string[] = [];
  const jobIds: string[] = [];

  const createAgent = async (api: ApiClient, workspaceId: string) => {
    const jobAgentId = uuidv4();
    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
      {
        params: { path: { workspaceId, jobAgentId } },
        body: {
          name: `pull-agent-${faker.string.alphanumeric(8)}`,
          type: "http-pull",
          config: {},
        },
      },
    );
    expect(res.response.status).toBe(202);
    agentIds.push(jobAgentId);
    return jobAgentId;
  };

  const seedJob = async (
    jobAgentId: string,
    status: "queued" | "in_progress" | "successful",
    dispatchContext: Record<string, unknown> = {},
  ) => {
    const id = uuidv4();
    await db.insert(schema.job).values({
      id,
      jobAgentId,
      status,
      jobAgentConfig: {},
      dispatchContext,
    });
    jobIds.push(id);
    return id;
  };

  const listJobs = (
    api: ApiClient,
    workspaceId: string,
    jobAgentId: string,
    query: {
      status?: "queued";
      includeDispatchContext?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    api.GET("/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs", {
      params: { path: { workspaceId, jobAgentId }, query },
    });

  const claim = (
    api: ApiClient,
    workspaceId: string,
    jobAgentId: string,
    jobId: string,
  ) =>
    api.POST(
      "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}/jobs/{jobId}/claim",
      { params: { path: { workspaceId, jobAgentId, jobId } } },
    );

  test.afterAll(async ({ api, workspace }) => {
    if (jobIds.length > 0) {
      await db.delete(schema.job).where(inArray(schema.job.id, jobIds));
    }
    for (const jobAgentId of agentIds) {
      await api.DELETE(
        "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
        { params: { path: { workspaceId: workspace.id, jobAgentId } } },
      );
    }
  });

  // ---------- Retrieval ----------

  test("lists an agent's queued jobs filtered by status", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const queuedId = await seedJob(agentId, "queued");
    const inProgressId = await seedJob(agentId, "in_progress");

    const res = await listJobs(api, workspace.id, agentId, { status: "queued" });

    expect(res.response.status).toBe(200);
    const ids = res.data!.items.map((j) => j.id);
    expect(ids).toContain(queuedId);
    expect(ids).not.toContain(inProgressId);
  });

  test("omits dispatchContext by default and includes it on request", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const dispatchContext = {
      deployment: { id: uuidv4() },
      variables: { region: "us-east-1" },
    };
    const jobId = await seedJob(agentId, "queued", dispatchContext);

    const without = await listJobs(api, workspace.id, agentId, {
      status: "queued",
    });
    const jobWithout = without.data!.items.find((j) => j.id === jobId);
    expect(jobWithout).toBeDefined();
    expect(jobWithout!.dispatchContext).toBeUndefined();

    const withCtx = await listJobs(api, workspace.id, agentId, {
      status: "queued",
      includeDispatchContext: true,
    });
    const jobWith = withCtx.data!.items.find((j) => j.id === jobId);
    expect(jobWith!.dispatchContext).toEqual(dispatchContext);
  });

  test("only returns jobs for the requested agent", async ({
    api,
    workspace,
  }) => {
    const agentA = await createAgent(api, workspace.id);
    const agentB = await createAgent(api, workspace.id);
    const jobA = await seedJob(agentA, "queued");
    const jobB = await seedJob(agentB, "queued");

    const res = await listJobs(api, workspace.id, agentA, { status: "queued" });

    const ids = res.data!.items.map((j) => j.id);
    expect(ids).toContain(jobA);
    expect(ids).not.toContain(jobB);
  });

  test("returns 404 listing jobs for an agent not in the workspace", async ({
    api,
    workspace,
  }) => {
    const res = await listJobs(api, workspace.id, uuidv4());
    expect(res.response.status).toBe(404);
  });

  test("returns an empty list when the agent has no queued jobs", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);

    const res = await listJobs(api, workspace.id, agentId, { status: "queued" });

    expect(res.response.status).toBe(200);
    expect(res.data!.items).toHaveLength(0);
    expect(res.data!.total).toBe(0);
  });

  test("returns all queued jobs and paginates with limit and offset", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const seeded = [
      await seedJob(agentId, "queued"),
      await seedJob(agentId, "queued"),
      await seedJob(agentId, "queued"),
    ];

    const all = await listJobs(api, workspace.id, agentId, { status: "queued" });
    expect(all.response.status).toBe(200);
    expect(all.data!.total).toBe(3);
    expect(all.data!.items.map((j) => j.id).sort()).toEqual(
      [...seeded].sort(),
    );

    const firstPage = await listJobs(api, workspace.id, agentId, {
      status: "queued",
      limit: 2,
      offset: 0,
    });
    expect(firstPage.data!.items).toHaveLength(2);
    expect(firstPage.data!.total).toBe(3);
    expect(firstPage.data!.limit).toBe(2);
    expect(firstPage.data!.offset).toBe(0);

    const secondPage = await listJobs(api, workspace.id, agentId, {
      status: "queued",
      limit: 2,
      offset: 2,
    });
    expect(secondPage.data!.items).toHaveLength(1);
    expect(secondPage.data!.total).toBe(3);

    const allIds = [
      ...firstPage.data!.items.map((j) => j.id),
      ...secondPage.data!.items.map((j) => j.id),
    ].sort();
    expect(allIds).toEqual([...seeded].sort());
  });

  // ---------- Claiming ----------

  test("claims a queued job and transitions it to in_progress", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const dispatchContext = { variables: { foo: "bar" } };
    const jobId = await seedJob(agentId, "queued", dispatchContext);

    const res = await claim(api, workspace.id, agentId, jobId);

    expect(res.response.status).toBe(200);
    expect(res.data!.id).toBe(jobId);
    expect(res.data!.status).toBe("inProgress");
    expect(res.data!.startedAt).toBeDefined();
    expect(res.data!.dispatchContext).toEqual(dispatchContext);

    const row = await db
      .select()
      .from(schema.job)
      .where(eq(schema.job.id, jobId))
      .then((rows) => rows[0]);
    expect(row!.status).toBe("in_progress");
    expect(row!.startedAt).not.toBeNull();
  });

  test("returns 409 when claiming a job that is no longer queued", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const jobId = await seedJob(agentId, "queued");

    const first = await claim(api, workspace.id, agentId, jobId);
    expect(first.response.status).toBe(200);

    const second = await claim(api, workspace.id, agentId, jobId);
    expect(second.response.status).toBe(409);
  });

  test("returns 404 claiming a non-existent job", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const res = await claim(api, workspace.id, agentId, uuidv4());
    expect(res.response.status).toBe(404);
  });

  test("returns 404 claiming a job that belongs to a different agent", async ({
    api,
    workspace,
  }) => {
    const agentA = await createAgent(api, workspace.id);
    const agentB = await createAgent(api, workspace.id);
    const jobId = await seedJob(agentB, "queued");

    const res = await claim(api, workspace.id, agentA, jobId);
    expect(res.response.status).toBe(404);
  });

  test("hands a job to exactly one of many concurrent claimers", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const jobId = await seedJob(agentId, "queued");

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        claim(api, workspace.id, agentId, jobId),
      ),
    );

    const statuses = attempts.map((a) => a.response.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
  });

  test("a claimed job no longer appears in the queued list", async ({
    api,
    workspace,
  }) => {
    const agentId = await createAgent(api, workspace.id);
    const jobId = await seedJob(agentId, "queued");

    const claimed = await claim(api, workspace.id, agentId, jobId);
    expect(claimed.response.status).toBe(200);

    const res = await listJobs(api, workspace.id, agentId, { status: "queued" });
    expect(res.data!.items.map((j) => j.id)).not.toContain(jobId);
  });
});
