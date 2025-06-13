import path from "path";
import { expect } from "@playwright/test";
import _ from "lodash";
import { Client } from "openapi-fetch";

import { cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";

const yamlPath = path.join(__dirname, "new-entity-triggers.spec.yaml");

test.describe("trigger new jobs", () => {
  let builder: EntitiesBuilder;

  test.beforeEach(async ({ api, workspace }) => {
    builder = new EntitiesBuilder(api, workspace, yamlPath);

    expect((await builder.upsertSystem()).fetchResponse.response.ok).toBe(true);

    (await builder.upsertEnvironments()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertDeployments()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });
  });

  test.afterEach(async ({ api, workspace }) => {
    await cleanupImportedEntities(api, builder.refs, workspace.id);
  });

  test("trigger with initial deployment versions", async ({ api }) => {
    (await builder.upsertResources()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertAgents()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    // Attach agent to deployment:
    (await builder.upsertDeployments(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // triggers job
    (await builder.createDeploymentVersions()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger with initial agent attachment", async ({ api }) => {
    (await builder.upsertResources()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    (await builder.upsertAgents()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    (await builder.createDeploymentVersions()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // Attach agent to deployment -> triggers job
    (await builder.upsertDeployments(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger with initial resources", async ({ api }) => {
    (await builder.upsertAgents()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    const agentId = builder.refs.oneAgent().id;

    (await builder.createDeploymentVersions()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // Attach agent to deployment:
    (await builder.upsertDeployments(agentId)).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    // triggers job
    (await builder.upsertResources()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(api, agentId, 4);
  });

  test("trigger subsequent jobs with new version for ONE deployment", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    const resourcesPerDeployment = 2;
    await builder.cloneDeploymentVersionAndUpsert(
      builder.refs.oneDeployment().id,
    );
    // should only create jobs for each resource on a _single_ deployment
    await expectJobQueueCount(
      builder.api,
      agentId,
      resourcesPerDeployment,
    );
  });

  test("trigger subsequent jobs for new resources -- cloning each existing resource", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    // new resources will be the same as existing resource count, since each existing will be cloned
    const newResourceCount = builder.refs.resources.length;
    (await builder.cloneFixtureResourcesAndUpsert()).forEach((fr) => {
      expect(fr.fetchResponse.response.ok).toBe(true);
    });

    await expectJobQueueCount(
      builder.api,
      agentId,
      newResourceCount,
    );
  });


  test("trigger NO jobs for new deployments WITHOUT agentId; deployment has resources", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    await builder.cloneDeploymentsAndUpsert(/* NO agentId */);
    
    await expectJobQueueEmpty(builder.api, agentId);
  });

  test("trigger new jobs for new deployments WITH agentId; deployment has resources", async () => {
    const agentId = await initialJobsTriggerHelper(builder);

    await builder.cloneDeploymentsAndUpsert(agentId);
    
    await expectJobQueueCount(builder.api, agentId, 4);
  });
});

async function expectJobQueueCount(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  expectedJobCount: number,
): Promise<Job[]> {
  let jobs: Job[] = [];
  let attempts = 0;

  while (jobs.length < expectedJobCount && attempts < 5) {
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
): Promise<void> {
  let attempts = 0;

  while (attempts < 5) {
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
    expect(nextJobs?.jobs?.length).toBe(0);
  }
}

/** Ensure there are no jobs in the queue before next tests are called */
async function clearJobQueue(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const fetchResponse = await api.GET("/v1/job-agents/{agentId}/queue/next", {
    params: {
      path: {
        agentId,
      },
    },
  });
  expect(fetchResponse.response.ok).toBe(true);
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
  (await builder.upsertAgents()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  const agentId = builder.refs.oneAgent().id;

  (await builder.createDeploymentVersions()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  // Attach agent to deployment:
  (await builder.upsertDeployments(agentId)).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  // triggers job
  (await builder.upsertResources()).forEach((fr) => {
    expect(fr.fetchResponse.response.ok).toBe(true);
  });

  await clearJobQueue(builder.api, agentId);

  return agentId;
}

interface Job {
  id: string;
  jobAgentId: string;
  status: string;
}
