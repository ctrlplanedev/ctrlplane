import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
});

const api = new DefaultApi(config);

const setOutputsRecursively = (prefix: string, obj: any) => {
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}_${key}` : key;
      if (typeof value === "object" && value !== null) {
        setOutputsRecursively(newPrefix, value);
      } else {
        core.info(`${newPrefix}: ${String(value)}`);
        core.setOutput(newPrefix, value);
      }
    }
  } else {
    core.info(`${prefix}: ${String(obj)}`);
    core.setOutput(prefix, obj);
  }
};

async function run() {
  const jobId = core.getInput("job_id", { required: true });

  await api
    .getJob({ jobId })
    .then((response) => {
      const { variables, target, release, environment, config } = response;

      core.setOutput("target_name", target?.name);
      core.setOutput("environment_name", environment?.name);
      core.setOutput("release_version", release?.version);

      core.info(`Target name: ${target?.name}`);
      core.info(`Environment name: ${environment?.name}`);
      core.info(`Release version: ${release?.version}`);

      setOutputsRecursively("config", config);
      setOutputsRecursively("variable", variables ?? {});
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
    });
}

run();
