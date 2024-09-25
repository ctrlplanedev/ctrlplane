import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

async function run() {
  const jobId = core.getInput("job_id", { required: true });

  await api
    .getJob({ jobId })
    .then((response) => {
      const { variables, target, release, environment, config } = response;

      core.setOutput("target_name", target?.name);
      core.setOutput("environment_name", environment?.name);
      core.setOutput("release_version", release?.version);

      for (const [key, value] of Object.entries(config ?? {}))
        core.setOutput(`config_${key}`, value);
      for (const [key, value] of Object.entries(variables ?? {}))
        core.setOutput(`variable_${key}`, value);
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
