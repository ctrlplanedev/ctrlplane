import path from "path";
import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";
import _ from "lodash";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { EnvironmentFixture } from "../../../api/entity-fixtures";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "new-entity-triggers.spec.yaml");

test.describe("trigger new jobs", () => {
  let builder: EntitiesBuilder;

  test.beforeEach(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    expect(
      (await builder.upsertSystemFixture()).fetchResponse.response.ok,
    ).toBe(true);

    (await builder.upsertEnvironmentFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertDeploymentFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });
  });

  test.afterEach(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("trigger with initial deployment versions", async ({ api }) => {
    (await builder.upsertResourcesFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertAgentFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    // Attach agent to deployment:
    (await builder.upsertDeploymentFixtures(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // triggers job
    (await builder.upsertDeploymentVersionFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger with initial agent attachment", async ({ api }) => {
    (await builder.upsertResourcesFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertAgentFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    (await builder.upsertDeploymentVersionFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // Attach agent to deployment -> triggers job
    (await builder.upsertDeploymentFixtures(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger with initial resources", async ({ api }) => {
    (await builder.upsertAgentFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    (await builder.upsertDeploymentVersionFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // Attach agent to deployment:
    (await builder.upsertDeploymentFixtures(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // triggers job
    (await builder.upsertResourcesFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger new jobs with new version for ONE deployment", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    const resourcesPerDeployment = 2;
    await builder.createDeploymentVersionFixtureClone(
      builder.refs.oneDeployment().id,
    );
    // should only create jobs for each resource on a _single_ deployment
    await expectJobQueueCount(builder.api, agentId, resourcesPerDeployment);
  });

  test("trigger new jobs for new resources -- cloning each existing resource", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    // new resources will be the same as existing resource count, since each existing will be cloned
    const newResourceCount = builder.refs.resources.length;
    (await builder.createResourceFixtureClones()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(builder.api, agentId, newResourceCount);
  });

  test("trigger NO jobs for new deployments WITHOUT agentId; deployment has resources", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    await builder.createDeploymentFixtureClones(/* NO agentId */);

    await expectJobQueueEmpty(builder.api, agentId);
  });

  test("trigger new jobs for new deployments WITH agentId; deployment has resources", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    await builder.createDeploymentFixtureClones(agentId);

    await expectJobQueueCount(builder.api, agentId, 4);
  });

  test("trigger NO jobs for switching agents on deployments", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    const newAgentId = (await builder.createAgentFixtureClones())[0]
      .fetchResponse.data!.id;

    expect(newAgentId).not.toBe(agentId);

    // Attach NEW agent to deployment:
    (await builder.upsertDeploymentFixtures(newAgentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // attaching different agent to deployment should not trigger on old agentId or newAgentId
    await expectJobQueueEmpty(builder.api, newAgentId);
    await expectJobQueueEmpty(builder.api, agentId, 250);
  });

  test("trigger NO jobs with upserting identical resources", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    (await builder.upsertResourcesFixtures()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueEmpty(builder.api, agentId);
  });

  test("trigger NO jobs with upserting new environments with NO resource selectors", async () => {
    const agentId = await initialJobsTriggerHelper(builder);
    const randomResourceSelBuilder = (_original: EnvironmentFixture) => {
      return undefined;
    };

    (
      await builder.createEnvironmentFixtureClones(randomResourceSelBuilder)
    ).forEach((f) => {
      expect(f.fetchResponse.response.ok).toBe(true);
      expect(f.requestBody.resourceSelector).not.toBeDefined();
    });

    await expectJobQueueEmpty(builder.api, agentId);
  });

  test("trigger NO jobs with upserting new environments with NON-MATCHING resource selectors", async () => {
    const agentId = await initialJobsTriggerHelper(builder);
    const randomResourceSelBuilder = (_original: EnvironmentFixture) => {
      return {
        type: "metadata",
        key: "instance/tier",
        operator: "equals",
        value: faker.string.alphanumeric(5),
      };
    };
    (
      await builder.createEnvironmentFixtureClones(randomResourceSelBuilder)
    ).forEach((f) => {
      expect(f.fetchResponse.response.ok).toBe(true);
      expect(f.requestBody.resourceSelector).toBeDefined();
    });

    await expectJobQueueEmpty(builder.api, agentId);
  });
});

async function expectJobQueueCount(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  expectedJobCount: number,
): Promise<Job[]> {
  console.debug(
    `expect job queue count for agentId ${agentId} to be ${expectedJobCount}`,
  );
  let jobs: Job[] = [];
  let attempts = 0;

  while (jobs.length < expectedJobCount && attempts < 5) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const fetchResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
      params: {
        path: {
          agentId,
        },
      },
    });

    expect(fetchResponse.response.ok).toBe(true);

    const nextJobs = fetchResponse.data;
    expect(nextJobs?.jobs).toBeDefined();

    expect(Array.isArray(nextJobs?.jobs)).toBe(true);
    jobs.push(...((nextJobs?.jobs as Job[]) || []));
  }

  for (const job of jobs) {
    console.debug(`Job ${job.id} has status ${job.status}`);
    expect(job.jobAgentId).toBe(agentId);
    await updateJobStatus(api, job.id, "successful");
  }

  expect(
    jobs.every((job) => job.jobAgentId === agentId),
    "expected agentId",
  ).toBe(true);
  expect(
    _.uniq(jobs.map((job) => job.id)).length == jobs.length,
    "expected unique jobIds",
  ).toBe(true);

  expect(jobs.length, "job count").toBe(expectedJobCount);
  return jobs;
}

async function expectJobQueueEmpty(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  timeout: number = 5000,
): Promise<void> {
  console.debug(`expect empty job queue for agentId ${agentId}`);
  await new Promise((resolve) => setTimeout(resolve, timeout));
  const fetchResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
    params: {
      path: {
        agentId,
      },
    },
  });

  expect(fetchResponse.response.ok).toBe(true);

  const nextJobs = fetchResponse.data;
  expect(nextJobs?.jobs).toBeDefined();

  for (const job of nextJobs?.jobs || []) {
    console.debug(`Job ${job.id} has status ${job.status}`);
    expect(job.jobAgentId).toBe(agentId);
    await updateJobStatus(api, job.id, "successful");
  }

  expect(Array.isArray(nextJobs?.jobs)).toBe(true);
  expect(nextJobs?.jobs?.length).toBe(0);
}

/** Ensure there are no jobs in the queue before next tests are called */
async function clearJobQueue(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
): Promise<void> {
  console.debug(`clear job queue for agentId ${agentId}`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const fetchResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
    params: {
      path: {
        agentId,
      },
    },
  });
  expect(fetchResponse.response.ok).toBe(true);
  const nextJobs = fetchResponse.data;
  for (const job of nextJobs?.jobs || []) {
    console.debug(`Clearing Job Queue: ${job.id} has status ${job.status}`);
    expect(job.jobAgentId).toBe(agentId);
    await updateJobStatus(api, job.id, "successful");
  }
}

/**
 * Helper function to create initial jobs and clear the queue.
 * Allows testing for subsequent job triggers.
 * @param builder
 * @returns the agentId that was used to create jobs
 */
async function initialJobsTriggerHelper(
  builder: EntitiesBuilder,
): Promise<string> {
  (await builder.upsertAgentFixtures()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  const agentId = builder.refs.oneAgent().id;

  (await builder.upsertDeploymentVersionFixtures()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  // Attach agent to deployment:
  (await builder.upsertDeploymentFixtures(agentId)).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  // triggers job
  (await builder.upsertResourcesFixtures()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  await clearJobQueue(builder.api, agentId);

  return agentId;
}

type JobStatus =
  | "successful"
  | "cancelled"
  | "skipped"
  | "in_progress"
  | "action_required"
  | "pending"
  | "failure"
  | "invalid_job_agent"
  | "invalid_integration"
  | "external_run_not_found";

interface Job {
  id: string;
  jobAgentId: string;
  status: JobStatus;
}

async function updateJobStatus(
  api: Client<paths, `${string}/${string}`>,
  jobId: string,
  status: JobStatus,
): Promise<void> {
  const fetchResponse = await api.PATCH(`/v1/jobs/{jobId}`, {
    params: {
      path: {
        jobId,
      },
    },
    body: {
      status,
    },
  });
  expect(fetchResponse.response.ok).toBe(true);
}
