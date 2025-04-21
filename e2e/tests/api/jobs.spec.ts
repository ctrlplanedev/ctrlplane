import type { PathsWithMethod } from "openapi-typescript-helpers";

import type { paths } from "../../api/schema";
import { test } from "../../fixtures";

test("should create and retrieve a job with new engine", async ({ api }) => {
  // Create a job
  const createResponse = await api.POST(
    "/v1/jobs" as PathsWithMethod<paths, "post">,
    {
      body: {
        deploymentId: "test-deployment",
        name: "test-job",
        status: "ready",
        versionSelector: {
          version: "1.0.0",
        },
        jobAgentConfig: {
          engine: "new",
        },
      },
    },
  );

  const jobData = createResponse.data;
  if (!jobData || typeof jobData !== "object" || !("id" in jobData)) {
    throw new Error("Job creation failed or returned unexpected data");
  }

  expect(jobData.id).toBeDefined();
  expect(jobData.status).toBe("ready");
  expect(jobData.jobAgentConfig).toBeDefined();
  expect(jobData.jobAgentConfig.engine).toBe("new");
  expect(jobData.createdAt).toBeDefined();
  expect(jobData.updatedAt).toBeDefined();

  // Get the job
  const getResponse = await api.GET(
    `/v1/jobs/${jobData.id}` as PathsWithMethod<paths, "get">,
    {
      params: {
        path: {
          jobId: jobData.id,
        },
      },
    },
  );

  const retrievedJob = getResponse.data;
  if (
    !retrievedJob ||
    typeof retrievedJob !== "object" ||
    !("id" in retrievedJob)
  ) {
    throw new Error("Job retrieval failed or returned unexpected data");
  }

  expect(retrievedJob.id).toBe(jobData.id);
  expect(retrievedJob.status).toBe("ready");
  expect(retrievedJob.jobAgentConfig).toBeDefined();
  expect(retrievedJob.jobAgentConfig.engine).toBe("new");
  expect(retrievedJob.createdAt).toBeDefined();
  expect(retrievedJob.updatedAt).toBeDefined();
});

test("should create and retrieve a job with legacy engine", async ({ api }) => {
  // Create a job
  const createResponse = await api.POST(
    "/v1/jobs" as PathsWithMethod<paths, "post">,
    {
      body: {
        deploymentId: "test-deployment",
        name: "test-job-legacy",
        status: "ready",
        versionSelector: {
          version: "1.0.0",
        },
        jobAgentConfig: {
          engine: "legacy",
        },
      },
    },
  );

  const jobData = createResponse.data;
  if (!jobData || typeof jobData !== "object" || !("id" in jobData)) {
    throw new Error("Job creation failed or returned unexpected data");
  }

  expect(jobData.id).toBeDefined();
  expect(jobData.status).toBe("ready");
  expect(jobData.jobAgentConfig).toBeDefined();
  expect(jobData.jobAgentConfig.engine).toBe("legacy");
  expect(jobData.createdAt).toBeDefined();
  expect(jobData.updatedAt).toBeDefined();

  // Get the job
  const getResponse = await api.GET(
    `/v1/jobs/${jobData.id}` as PathsWithMethod<paths, "get">,
    {
      params: {
        path: {
          jobId: jobData.id,
        },
      },
    },
  );

  const retrievedJob = getResponse.data;
  if (
    !retrievedJob ||
    typeof retrievedJob !== "object" ||
    !("id" in retrievedJob)
  ) {
    throw new Error("Job retrieval failed or returned unexpected data");
  }

  expect(retrievedJob.id).toBe(jobData.id);
  expect(retrievedJob.status).toBe("ready");
  expect(retrievedJob.jobAgentConfig).toBeDefined();
  expect(retrievedJob.jobAgentConfig.engine).toBe("legacy");
  expect(retrievedJob.createdAt).toBeDefined();
  expect(retrievedJob.updatedAt).toBeDefined();
});
