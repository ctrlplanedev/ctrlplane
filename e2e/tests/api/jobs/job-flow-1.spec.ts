import path from "path";
import { expect } from "@playwright/test";
import _ from "lodash";
import { Client } from "openapi-fetch";

import { addNewDeploymentVersion, cleanupImportedEntities, EntitiesBuilder, paths } from "../../../api";
import { test } from "../../fixtures";
import { faker } from "@faker-js/faker";

const yamlPath = path.join(__dirname, "job-flow-entities.spec.yaml");

test.describe("queue initial jobs", () => {
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

    await nextJobs(api, agentId, 4);

    await subsequentJobs(builder);
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

    await nextJobs(api, agentId, 4);

    await subsequentJobs(builder);
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

    await nextJobs(api, agentId, 4);

    await subsequentJobs(builder);
  });
});

/**
 * Given an initial run of jobs, this will test various ways that subsequent jobs may be triggered.
 * @param api
 * @param builder
 * @param curDeploymentCount is the preexisting number of deployments that will get triggered
 */
async function subsequentJobs(
  builder: EntitiesBuilder,
) {
  const jobsPerDeployment = 2; // each deployment has two resources, hence two jobs per trigger
  await addNewDeploymentVersion(
    builder,
    builder.refs.oneDeployment().id,
    faker.string.alphanumeric(5),
  );
  try {
    await nextJobs(builder.api, builder.refs.oneAgent().id, jobsPerDeployment);
  } catch (e) {
    console.error(`Continue after error: ${e}`);
  }

  
}

async function nextJobs(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
  expectedJobCount: number,
): Promise<Job[]> {
  let jobs: Job[] = [];
  let attempts = 0;

  while (jobs.length < expectedJobCount && attempts < ) {
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

async function noNextJobs(
  api: Client<paths, `${string}/${string}`>,
  agentId: string,
): Promise<void> {
  let attempts = 0;

  while (attempts < 4) {
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

interface Job {
  id: string;
  jobAgentId: string;
  status: string;
}
