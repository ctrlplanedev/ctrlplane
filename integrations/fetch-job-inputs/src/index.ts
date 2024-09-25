import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

const requiredOutputs = core
  .getInput("required_outputs", { required: false })
  .split("\n")
  .map((output) => output.trim());

const setOutputAndLog = (key: string, value: any) => {
  core.setOutput(key, value);
  core.info(`${key}: ${value}`);
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
  const outputTracker: Record<string, boolean> = {};

  const trackOutput = (key: string, value: any) => {
    if (value !== undefined && value !== null) {
      outputTracker[key] = true;
    }
    setOutputAndLog(key, value);
  };

  await api
    .getJob({ jobId })
    .then((response) => {
      const { variables, target, release, environment, runbook, deployment } =
        response;

      trackOutput("target_id", target?.id);
      trackOutput("target_name", target?.name);
      trackOutput("target_kind", target?.kind);
      trackOutput("target_version", target?.version);
      trackOutput("target_identifier", target?.identifier);

      trackOutput("workspace_id", target?.workspaceId);

      trackOutput("environment_id", environment?.id);
      trackOutput("environment_name", environment?.name);

      trackOutput("release_id", release?.id);
      trackOutput("release_version", release?.version);

      trackOutput("deployment_id", deployment?.id);
      trackOutput("deployment_name", deployment?.name);
      trackOutput("deployment_slug", deployment?.slug);

      trackOutput("runbook_id", runbook?.id);
      trackOutput("runbook_name", runbook?.name);

      trackOutput(
        "system_id",
        deployment?.systemId ?? runbook?.systemId ?? environment?.systemId,
      );
      trackOutput("agent_id", deployment?.jobAgentId ?? runbook?.jobAgentId);

      setOutputsRecursively("target_config", target?.config);
      setOutputsRecursively("variables", variables ?? {});
    })
    .then(() => {
      const missingOutputs = requiredOutputs.filter(
        (output) => !outputTracker[output],
      );

      if (missingOutputs.length > 0)
        core.setFailed(
          `Missing required outputs: ${missingOutputs.join(", ")}`,
        );
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
