import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const baseUrl = core.getInput("base_url", { required: true });

const config = new Configuration({
  basePath: baseUrl + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

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
  core.setOutput(key, value);
  core.info(`${key}: ${value}`);
  trackOutput(key, value);
};

const setOutputsRecursively = (prefix: string, obj: any) => {
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.split(".").join("_");
      const newPrefix = prefix ? `${prefix}_${sanitizedKey}` : sanitizedKey;
      if (typeof value === "object" && value !== null)
        setOutputsRecursively(newPrefix, value);
      setOutputAndLog(newPrefix, value);
    }
    return;
  }
  setOutputAndLog(prefix, obj);
};

async function run() {
  const jobId = core.getInput("job_id", { required: true });

  await api
    .getJob({ jobId })
    .then((response) => {
      const { variables, target, release, environment, runbook, deployment } =
        response;

      setOutputAndLog("base_url", baseUrl);

      setOutputAndLog("target_id", target?.id);
      setOutputAndLog("target_name", target?.name);
      setOutputAndLog("target_kind", target?.kind);
      setOutputAndLog("target_version", target?.version);
      setOutputAndLog("target_identifier", target?.identifier);

      setOutputAndLog("workspace_id", target?.workspaceId);

      setOutputAndLog("environment_id", environment?.id);
      setOutputAndLog("environment_name", environment?.name);

      setOutputAndLog("release_id", release?.id);
      setOutputAndLog("release_version", release?.version);

      setOutputAndLog("deployment_id", deployment?.id);
      setOutputAndLog("deployment_name", deployment?.name);
      setOutputAndLog("deployment_slug", deployment?.slug);

      setOutputAndLog("runbook_id", runbook?.id);
      setOutputAndLog("runbook_name", runbook?.name);

      setOutputAndLog(
        "system_id",
        deployment?.systemId ?? runbook?.systemId ?? environment?.systemId,
      );
      setOutputAndLog(
        "agent_id",
        deployment?.jobAgentId ?? runbook?.jobAgentId,
      );

      setOutputsRecursively("target_config", target?.config);
      setOutputsRecursively("variables", variables ?? {});
    })
    .then(() => {
      if (requiredOutputs.length > 0) {
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
        return;
      }
      core.info("No required_outputs set for this job");
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
