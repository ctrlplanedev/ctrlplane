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
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  core.setOutput(key, stringValue);
  core.info(`${key}: ${stringValue}`);
  trackOutput(key, value);
};

const setOutputsRecursively = (prefix: string, obj: any) => {
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.replace(/[.\-/\s\t]+/g, "_");
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
      core.info(JSON.stringify(response, null, 2));

      const {
        variables,
        target,
        release,
        environment,
        runbook,
        deployment,
        approval,
      } = response;

      setOutputAndLog("base_url", baseUrl);

      setOutputAndLog("target", target);
      setOutputAndLog("target_id", target?.id);
      setOutputAndLog("target_name", target?.name);
      setOutputAndLog("target_kind", target?.kind);
      setOutputAndLog("target_version", target?.version);
      setOutputAndLog("target_identifier", target?.identifier);
      setOutputsRecursively("target_config", target?.config);
      setOutputsRecursively("target_metadata", target?.metadata);

      setOutputAndLog("workspace_id", target?.workspaceId);

      setOutputAndLog("environment_id", environment?.id);
      setOutputAndLog("environment_name", environment?.name);

      setOutputAndLog("release_id", release?.id);
      setOutputAndLog("release_version", release?.version);
      setOutputsRecursively("release_config", release?.config);
      setOutputsRecursively("release_metadata", release?.metadata);

      if (approval?.approver != null) {
        setOutputAndLog("approval_approver_id", approval.approver.id);
        setOutputAndLog("approval_approver_name", approval.approver.name);
      }

      setOutputAndLog("deployment_id", deployment?.id);
      setOutputAndLog("deployment_name", deployment?.name);
      setOutputAndLog("deployment_slug", deployment?.slug);

      for (const [key, value] of Object.entries(variables)) {
        const sanitizedKey = key.replace(/[.\-/\s\t]+/g, "_");
        setOutputAndLog(`variable_${sanitizedKey}`, value);
      }

      setOutputAndLog("runbook_id", runbook?.id);
      setOutputAndLog("runbook_name", runbook?.name);

      const systemId =
        deployment?.systemId ?? runbook?.systemId ?? environment?.systemId;
      setOutputAndLog("system_id", systemId);

      const agentId = deployment?.jobAgentId ?? runbook?.jobAgentId;
      setOutputAndLog("agent_id", agentId);
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
