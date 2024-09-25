import * as core from "@actions/core";
import pRetry from "p-retry";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

async function fetchWithRetry(jobId: string) {
  return pRetry(
    async () => {
      await api.acknowledgeJob({ jobId });
      return await api.getJob({ jobId });
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        core.warning(
          `Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
        );
      },
    },
  );
}

function run() {
  const jobId = core.getInput("job_id", { required: true });

  return fetchWithRetry(jobId)
    .then((response) => {
      const targetName = response.target?.name;
      const environmentName = response.environment?.name;
      const releaseVersion = response.release?.version;
      const location = response.target?.config.location;
      const project = response.target?.config.project;
      const variables = response.variables;

      core.setOutput("target_name", targetName);
      core.setOutput("environment_name", environmentName);
      core.setOutput("release_version", releaseVersion);
      core.setOutput("target.location", location);
      core.setOutput("target.project", project);

      for (const [key, value] of Object.entries(variables ?? {})) {
        core.setOutput(`variable.${key}`, value);
      }
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
