import type { Operations } from "@ctrlplane/web-api";
import * as core from "@actions/core";

import { api } from "./sdk.js";

const requiredOutputs = core
  .getInput("required_outputs", { required: false })
  .split("\n")
  .filter((output) => output.trim() !== "")
  .map((output) => output.trim());

const outputTracker = new Set<string>();
const trackOutput = (key: string, value: any) => {
  if (value !== undefined && value !== null) outputTracker.add(key);
};

const setOutputAndLog = (key: string, value: any) => {
  if (value === undefined || value === null) return;
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  core.setOutput(key, stringValue);
  core.info(`${key}: ${stringValue}`);
  trackOutput(key, value);
};

const setOutputsRecursively = (prefix: string | null, obj: any) => {
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/[.\-/\s\t]+/g, "_");
      const newPrefix =
        prefix != null ? `${prefix}_${sanitizedKey}` : sanitizedKey;
      if (typeof value === "object" && value !== null)
        setOutputsRecursively(newPrefix, value);
      setOutputAndLog(newPrefix, value);
    }
    return;
  }
  if (prefix != null) setOutputAndLog(prefix, obj);
};

type Job =
  Operations["getJobWithRelease"]["responses"]["200"]["content"]["application/json"];

type JobWithWorkspace = Job & {
  workspaceId: string;
};

const getJob = async (jobId: string): Promise<JobWithWorkspace | null> => {
  const workspaceIdsResponse = await api.GET("/v1/workspaces");
  const workspaces = workspaceIdsResponse.data?.workspaces ?? [];
  const workspaceIds = workspaces.map(({ id }) => id);

  for (const workspaceId of workspaceIds) {
    const jobResponse = await api.GET(
      "/v1/workspaces/{workspaceId}/jobs/{jobId}/with-release",
      { params: { path: { workspaceId, jobId } } },
    );

    const job = jobResponse.data;
    if (job != null) return { ...job, workspaceId };
  }

  return null;
};

async function run() {
  const jobId: string = core.getInput("job_id", { required: true });
  const baseUrl = core.getInput("base_url") || "https://app.ctrlplane.dev";

  const job = await getJob(jobId);
  if (job == null) {
    core.setFailed(`Job not found: ${jobId}`);
    return;
  }

  const ghActionsJobObject = {
    ...job.job,
    base: { url: baseUrl },
    variable: job.release.variables,
    resource: job.resource,
    version: job.release.version,
    workspace: { id: job.workspaceId },
    environment: job.environment,
    deployment: job.deployment,
  };

  setOutputsRecursively(null, ghActionsJobObject);

  const missingOutputs = requiredOutputs.filter(
    (output) => !outputTracker.has(output),
  );

  if (missingOutputs.length > 0) {
    core.setFailed(`Missing required outputs: ${missingOutputs.join(", ")}`);
    return;
  }
}

run();
