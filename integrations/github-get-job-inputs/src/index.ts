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
        release,
        version,
        environment,
        runbook,
        deployment,
        approval,
      } = data;

      setOutputAndLog("base_url", baseUrl);

      setOutputAndLog("resource", resource);
      setOutputAndLog("resource_id", resource?.id);
      setOutputAndLog("resource_name", resource?.name);
      setOutputAndLog("resource_kind", resource?.kind);
      setOutputAndLog("resource_version", resource?.version);
      setOutputAndLog("resource_identifier", resource?.identifier);
      setOutputsRecursively("resource_config", resource?.config);
      setOutputsRecursively("resource_metadata", resource?.metadata);

      setOutputAndLog("workspace_id", resource?.workspaceId);

      setOutputAndLog("environment_id", environment?.id);
      setOutputAndLog("environment_name", environment?.name);

      setOutputAndLog("version_id", version?.id);
      setOutputAndLog("version_tag", version?.tag);
      setOutputsRecursively("version_config", version?.config);
      setOutputsRecursively("version_metadata", version?.metadata);

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
