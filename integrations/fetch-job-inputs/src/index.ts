import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

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
  await api
    .getJob({ jobId })
    .then((response) => {
      const { variables, target, release, environment, runbook, deployment } =
        response;

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
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
