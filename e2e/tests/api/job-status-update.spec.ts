import { expect } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";

import { inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import { test } from "../fixtures";

// Exercises PUT /v1/workspaces/{workspaceId}/jobs/{jobId}/status. The request
// body is an object `{ status }` — a bare string is rejected by the strict JSON
// body parser (the bug this endpoint had). Jobs are seeded directly with the
// release linkage the handler requires: job -> release_job -> release ->
// deployment(in workspace).
test.describe("Job Status Update API", () => {
  const created = {
    jobIds: [] as string[],
    releaseIds: [] as string[],
    versionIds: [] as string[],
    deploymentIds: [] as string[],
    environmentIds: [] as string[],
    resourceIds: [] as string[],
  };

  const seedJob = async (
    workspaceId: string,
    status: "in_progress" | "pending" = "in_progress",
  ) => {
    const suffix = faker.string.alphanumeric(8);

    const deployment = await db
      .insert(schema.deployment)
      .values({ name: `status-deploy-${suffix}`, workspaceId })
      .returning()
      .then((rows) => rows[0]!);
    const resource = await db
      .insert(schema.resource)
      .values({
        name: `status-res-${suffix}`,
        kind: "TestKind",
        identifier: `status-res-${suffix}`,
        version: "1.0.0",
        workspaceId,
      })
      .returning()
      .then((rows) => rows[0]!);
    const environment = await db
      .insert(schema.environment)
      .values({ name: `status-env-${suffix}`, workspaceId })
      .returning()
      .then((rows) => rows[0]!);
    const version = await db
      .insert(schema.deploymentVersion)
      .values({
        name: suffix,
        tag: suffix,
        deploymentId: deployment.id,
        workspaceId,
      })
      .returning()
      .then((rows) => rows[0]!);
    const release = await db
      .insert(schema.release)
      .values({
        resourceId: resource.id,
        environmentId: environment.id,
        deploymentId: deployment.id,
        versionId: version.id,
      })
      .returning()
      .then((rows) => rows[0]!);
    const job = await db
      .insert(schema.job)
      .values({ status })
      .returning()
      .then((rows) => rows[0]!);
    await db
      .insert(schema.releaseJob)
      .values({ jobId: job.id, releaseId: release.id });

    created.jobIds.push(job.id);
    created.releaseIds.push(release.id);
    created.versionIds.push(version.id);
    created.deploymentIds.push(deployment.id);
    created.environmentIds.push(environment.id);
    created.resourceIds.push(resource.id);
    return job.id;
  };

  test.afterAll(async () => {
    if (created.jobIds.length > 0) {
      await db
        .delete(schema.releaseJob)
        .where(inArray(schema.releaseJob.jobId, created.jobIds));
      await db.delete(schema.job).where(inArray(schema.job.id, created.jobIds));
    }
    if (created.releaseIds.length > 0)
      await db
        .delete(schema.release)
        .where(inArray(schema.release.id, created.releaseIds));
    if (created.versionIds.length > 0)
      await db
        .delete(schema.deploymentVersion)
        .where(inArray(schema.deploymentVersion.id, created.versionIds));
    if (created.deploymentIds.length > 0)
      await db
        .delete(schema.deployment)
        .where(inArray(schema.deployment.id, created.deploymentIds));
    if (created.environmentIds.length > 0)
      await db
        .delete(schema.environment)
        .where(inArray(schema.environment.id, created.environmentIds));
    if (created.resourceIds.length > 0)
      await db
        .delete(schema.resource)
        .where(inArray(schema.resource.id, created.resourceIds));
  });

  test("updates a job's status via the { status } body", async ({
    api,
    workspace,
  }) => {
    const jobId = await seedJob(workspace.id, "in_progress");

    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/jobs/{jobId}/status",
      {
        params: { path: { workspaceId: workspace.id, jobId } },
        body: { status: "successful" },
      },
    );
    expect(res.response.status).toBe(202);

    const get = await api.GET("/v1/workspaces/{workspaceId}/jobs/{jobId}", {
      params: { path: { workspaceId: workspace.id, jobId } },
    });
    expect(get.response.status).toBe(200);
    expect(get.data!.status).toBe("successful");
    expect(get.data!.completedAt).toBeDefined();
  });

  test("returns 400 for an invalid status value", async ({
    api,
    workspace,
  }) => {
    const jobId = await seedJob(workspace.id);

    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/jobs/{jobId}/status",
      {
        params: { path: { workspaceId: workspace.id, jobId } },
        body: { status: "bogus" } as { status: "successful" },
      },
    );
    expect(res.response.status).toBe(400);
  });

  test("returns 404 for a non-existent job", async ({ api, workspace }) => {
    const res = await api.PUT(
      "/v1/workspaces/{workspaceId}/jobs/{jobId}/status",
      {
        params: { path: { workspaceId: workspace.id, jobId: uuidv4() } },
        body: { status: "successful" },
      },
    );
    expect(res.response.status).toBe(404);
  });
});
