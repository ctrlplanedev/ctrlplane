import path from "path";
import { expect, TestType } from "@playwright/test";
import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";
import { Client } from "openapi-fetch";
import _ from "lodash";
import {
  fetchResultHandler,
  fetchResultListHandler,
} from "../../../api/fetch-test-helpers";

const yamlPath = path.join(__dirname, "job-flow-entities.spec.yaml");

test.describe("queue initial jobs", () => {
  let builder: EntitiesBuilder;

  test.beforeEach(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    fetchResultHandler(
      test,
      await builder.upsertSystem(),
      /20[01]/,
    );

    fetchResultListHandler(
      test,
      await builder.upsertEnvironments(),
      /20[01]/,
    );

    fetchResultListHandler(
      test,
      await builder.upsertDeployments(),
      /20[01]/,
    );
  });

  test.afterEach(async ({ api, workspace }) => {
    fetchResultListHandler(
      test,
      await cleanupImportedEntities(api, builder.refs, workspace.id),
    );
  });

  test("trigger with initial deployment versions", async ({ api }) => {
    fetchResultListHandler(
      test,
      await builder.upsertResources(),
      /20[01]/,
    );

    fetchResultListHandler(
      test,
      await builder.upsertAgents(),
      /20[01]/,
    );

    const agentId = builder.refs.oneAgent().id;

    // Attach agent to deployment:
    fetchResultListHandler(
      test,
      await builder.upsertDeployments(agentId),
      /20[01]/,
    );

    // triggers job
    fetchResultListHandler(
      test,
      await builder.createDeploymentVersions(),
      /20[01]/,
    );

    await nextJobs(test, api, agentId, 4);
  });

  test("trigger with initial agent attachment", async ({ api }) => {
    fetchResultListHandler(
      test,
      await builder.upsertResources(),
      /20[01]/,
    );

    fetchResultListHandler(
      test,
      await builder.upsertAgents(),
      /20[01]/,
    );

    const agentId = builder.refs.oneAgent().id;

    fetchResultListHandler(
      test,
      await builder.createDeploymentVersions(),
      /20[01]/,
    );

    // Attach agent to deployment -> triggers job
    fetchResultListHandler(
      test,
      await builder.upsertDeployments(agentId),
      /20[01]/,
    );

    await nextJobs(test, api, agentId, 4);
  });

  test("trigger with initial resources", async ({ api }) => {
    fetchResultListHandler(
      test,
      await builder.upsertAgents(),
      /20[01]/,
    );

    const agentId = builder.refs.oneAgent().id;

    fetchResultListHandler(
      test,
      await builder.createDeploymentVersions(),
      /20[01]/,
    );

    // Attach agent to deployment:
    fetchResultListHandler(
      test,
      await builder.upsertDeployments(agentId),
      /20[01]/,
    );

    fetchResultListHandler(
      test,
      await builder.upsertResources(), // job trigger
      /20[01]/,
    );

    await nextJobs(test, api, agentId, 4);
  });
});

async function nextJobs(
  test: TestType<any, any>,
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  expectedJobCount: number,
): Promise<Job[]> {
  let jobs: Job[] = [];
  let attempts = 0;

  while (jobs.length < expectedJobCount && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const fetchResponse = await api.GET(
      "/v1/job-agents/{agentId}/queue/next",
      {
        params: {
          path: {
            agentId,
          },
        },
      },
    );

    fetchResultHandler(
      test,
      { fetchResponse },
      /20[01]/,
    );

    const nextJobs = fetchResponse.data;
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
