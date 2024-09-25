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

      core.setOutput("target.name", target?.name);
      core.setOutput("environment.name", environment?.name);
      core.setOutput("release.version", release?.version);

      console.log("job:", jobId);
      console.log("target name:", target?.name);

      console.log("release:", release);
      console.log("config:", config);
      console.log("variables:", variables);

      for (const [key, value] of Object.entries(config ?? {}))
        core.setOutput(`config.${key}`, value);
      for (const [key, value] of Object.entries(variables ?? {}))
        core.setOutput(`variable.${key}`, value);
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
