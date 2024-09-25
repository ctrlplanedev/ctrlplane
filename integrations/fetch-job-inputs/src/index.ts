import * as core from "@actions/core";

import { Configuration, DefaultApi } from "@ctrlplane/node-sdk";

const config = new Configuration({
  basePath: core.getInput("api_url", { required: true }) + "/api",
  apiKey: core.getInput("api_key", { required: true }),
  // basePath: "http://localhost:3000/api",
  // apiKey:
  //   "f5116107b520fb09.fa1421041eaeee226a384cc840b39773d89154ed48b4903380fc100edbab273d",
});

const api = new DefaultApi(config);

const setOutputsRecursively = (prefix: string, obj: any) => {
  if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = key.split(".").join("_");
      const newPrefix = prefix ? `${prefix}_${sanitizedKey}` : sanitizedKey;
      if (typeof value === "object" && value !== null) {
        setOutputsRecursively(newPrefix, value);
      } else {
        core.info(`${newPrefix}: ${String(value)}`);
        core.setOutput(newPrefix, value);
        console.log(`${newPrefix}: ${String(value)}`);
      }
    }
  } else {
    core.info(`${prefix}: ${String(obj)}`);
    core.setOutput(prefix, obj);
    console.log(`${prefix}: ${String(obj)}`);
  }
};

async function run() {
  const jobId = core.getInput("job_id", { required: true });
  // const jobId = "3953a1ea-3a41-4515-9fa5-809bc03cb51d";
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

      // console.log(`Target name: ${target?.name}`);
      // console.log(`Environment name: ${environment?.name}`);
      // console.log(`Release version: ${release?.version}`);

      setOutputsRecursively("config", config);
      setOutputsRecursively("variable", variables ?? {});
    })
    .catch((error) => {
      core.setFailed(`Action failed: ${error.message}`);
      // console.error(`Action failed: ${error.message}`);
    });
}

run();
