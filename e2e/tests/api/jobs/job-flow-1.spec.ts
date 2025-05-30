import path from "path";
import { expect } from "@playwright/test";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";
import { Client } from "openapi-fetch";
import _ from "lodash";

const yamlPath = path.join(__dirname, "job-flow-entities.spec.yaml");

test.describe("jobs from initial deployment version", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("job queue", async ({ api }) => {
    await builder.upsertSystem();
    await builder.upsertResources();
    await builder.upsertEnvironments();
    await builder.upsertDeployments();
    await builder.upsertAgents();
    const agentId = builder.refs.oneAgent().id;
    // Attach agent to deployment:
    await builder.upsertDeployments(agentId);
    await builder.createDeploymentVersions(); // job trigger

    await nextJobs(api, agentId, 4);
  });
});

test.describe("jobs from initial agent assignment", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("job queue", async ({ api }) => {
    await builder.upsertSystem();
    await builder.upsertResources();
    await builder.upsertEnvironments();
    await builder.upsertDeployments();
    await builder.upsertAgents();
    const agentId = builder.refs.oneAgent().id;
    await builder.createDeploymentVersions();
    // Attach agent to deployment:
    await builder.upsertDeployments(agentId); // job trigger

    await nextJobs(api, agentId, 4);
  });
});

test.describe("jobs from initial resource", () => {
  let builder: EntitiesBuilder;

  test.beforeAll(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);
  });

  test.afterAll(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("job queue", async ({ api }) => {
    await builder.upsertSystem();
    await builder.upsertEnvironments();
    await builder.upsertDeployments();
    await builder.upsertAgents();
    const agentId = builder.refs.oneAgent().id;
    await builder.createDeploymentVersions();
    // Attach agent to deployment:
    await builder.upsertDeployments(agentId);
    await builder.upsertResources(); // job trigger

    await nextJobs(api, agentId, 4);
  });
});

async function nextJobs(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  expectedJobCount: number,
): Promise<Job[]> {
  let jobs: Job[] = [];
  let attempts = 0;

  while (jobs.length < expectedJobCount && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const nextJobsResponse = await api.GET(
      "/v1/job-agents/{agentId}/queue/next",
      {
        params: {
          path: {
            agentId,
          },
        },
      },
    );

    expect(nextJobsResponse.response.status).toBe(200);

    const nextJobs = nextJobsResponse.data;
    expect(nextJobs?.jobs).toBeDefined();

    expect(Array.isArray(nextJobs?.jobs)).toBe(true);
    jobs.push(...nextJobs?.jobs as Job[] || []);
  }

  expect(jobs.every((job) => job.jobAgentId === agentId), "expected agentId")
    .toBe(true);
  expect(
    _.uniq(jobs.map((job) => job.id)).length == jobs.length,
    "expected unique jobIds",
  ).toBe(true);

  expect(jobs.length, "job count").toBe(expectedJobCount);
  return jobs;
}

interface Job {
  id: string;
  jobAgentId: string;
  status: string;
}
