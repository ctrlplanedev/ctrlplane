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

async function run() {
  const jobId: string = core.getInput("job_id", { required: true });
  const baseUrl = core.getInput("base_url") || "https://app.ctrlplane.dev";

  await api
    .GET("/v1/jobs/{jobId}", {
      params: { path: { jobId } },
    })
    .then(({ data }) => {
      if (data == null) {
        core.error(`Invalid Job data`);
        return;
      }

      const {
        variables,
        resource,
        version,
        environment,
        runbook,
        deployment,
        approval,
      } = data;

      setOutputsRecursively(null, {
        base: { url: baseUrl },
        variable: variables,
        resource,
        version,
        workspace: { id: resource?.workspaceId },
        environment: {
          id: environment?.id,
          name: environment?.name,
        },
        deployment: {
          id: deployment?.id,
          name: deployment?.name,
        },
        runbook,
        approval,
        system: {
          id:
            deployment?.systemId ?? runbook?.systemId ?? environment?.systemId,
        },
        agent: { id: deployment?.jobAgentId ?? runbook?.jobAgentId },
      });
    })
    .then(() => {
      if (requiredOutputs.length === 0) {
        core.info("No required_outputs set for this job");
        return;
      }

      core.info(
        `The required_outputs for this job are: ${requiredOutputs.join(", ")}`,
      );

      const missingOutputs = requiredOutputs.filter(
        (output) => !outputTracker.has(output),
      );

      if (missingOutputs.length > 0)
        core.setFailed(
          `Missing required outputs: ${missingOutputs.join(", ")}`,
        );
    })
    .catch((error) => core.setFailed(`Action failed: ${error.message}`));
}

run();
