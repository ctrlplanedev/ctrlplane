import type { Job } from "@ctrlplane/node-sdk";
import { CronJob } from "cron";
import handlebars from "handlebars";
import yaml from "js-yaml";

import { logger } from "@ctrlplane/logger";
import { JobAgent } from "@ctrlplane/node-sdk";

import { env } from "./config.js";
import { getBatchClient, getJobStatus } from "./k8s.js";
import { api } from "./sdk.js";

const renderManifest = (manifestTemplate: string, variables: object) => {
  try {
    const template = handlebars.compile(manifestTemplate);
    const manifestYaml = template(variables);
    return yaml.load(manifestYaml) as any;
  } catch (error) {
    logger.error("Error rendering manifest", { error });
    throw error;
  }
};

const deployManifest = async (
  job: Job,
  jobId: string,
  namespace: string,
  manifest: any,
) => {
  try {
    const name = manifest?.metadata?.name;
    logger.info(`Deploying manifest: ${namespace}/${name}`);

    if (name == null) {
      logger.error("Job name not found in manifest", {
        jobId,
        namespace,
        manifest,
      });
      await job.update({
        externalId: "",
        status: "invalid_job_agent",
        message: "Job name not found in manifest.",
      });
      return;
    }

    logger.info(`Creating job - ${namespace}/${name}`);

    await getBatchClient().createNamespacedJob(namespace, manifest);

    await job.update({
      status: "in_progress",
      externalId: `${namespace}/${name}`,
      message: "Job created successfully.",
    });

    logger.info(`Job created successfully`, {
      jobId,
      namespace,
      name,
    });
  } catch (error: any) {
    logger.error("Error deploying manifest", {
      jobId,
      namespace,
      error: error instanceof Error ? error.message : String(error),
    });

    await job.update({
      status: "invalid_job_agent" as const,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const spinUpNewJobs = async (agent: JobAgent, agentId: string) => {
  try {
    const jobs = await agent.next();
    logger.info(`Found ${jobs.length} job(s) to run.`);

    await Promise.allSettled(
      jobs.map(async (job: Job) => {
        const jobDetails = await job.get();
        logger.info(`Running job ${jobDetails.id}`);
        logger.debug(`Job details:`, { job: jobDetails });

        const manifest = renderManifest(
          jobDetails.jobAgentConfig.manifest,
          jobDetails,
        );
        const namespace = manifest?.metadata?.namespace ?? env.KUBE_NAMESPACE;

        await job.acknowledge();
        await deployManifest(job, jobDetails.id, namespace, manifest);
      }),
    );
  } catch (error: any) {
    logger.error("Error spinning up new jobs", {
      agentId: agentId,
      error: error.message,
    });
    throw error;
  }
};

const updateExecutionStatus = async (agent: JobAgent, agentId: string) => {
  try {
    const jobs = await agent.next();
    logger.info(`Found ${jobs.length} running execution(s)`);
    await Promise.allSettled(
      jobs.map(async (job: Job) => {
        const jobDetails = await job.get();
        const [namespace, name] = jobDetails.externalId?.split("/") ?? [];
        if (namespace == null || name == null) {
          logger.error("Invalid external run ID", {
            jobId: jobDetails.id,
            externalId: jobDetails.externalId,
          });
          return;
        }

        logger.debug(`Checking status of ${namespace}/${name}`);
        try {
          const { status, message } = await getJobStatus(namespace, name);
          await job.update({ status, message });
          logger.info(`Updated status for ${namespace}/${name}`, {
            status,
            message,
          });
        } catch (error: any) {
          logger.error(`Error updating status for ${namespace}/${name}`, {
            error: error.message,
          });
        }
      }),
    );
  } catch (error: any) {
    logger.error("Error updating execution statuses", {
      agentId,
      error: error.message,
    });
  }
};

const scan = async () => {
  try {
    const agent = new JobAgent(
      {
        name: env.CTRLPLANE_AGENT_NAME,
        workspaceId: env.CTRLPLANE_WORKSPACE_ID,
        type: "kubernetes-job",
      },
      api,
    );
    const { id } = await agent.get();

    logger.info(`Agent ID: ${id}`);
    await spinUpNewJobs(agent, id);
    await updateExecutionStatus(agent, id);
  } catch (error: any) {
    logger.error("Error during scan operation", { error: error.message });
    throw error;
  }
};

scan().catch((error) => {
  logger.error("Unhandled error in scan operation", { error: error.message });
  console.error(error);
});

if (env.CRON_ENABLED) {
  logger.info(`Enabling cron job, ${env.CRON_TIME}`, { time: env.CRON_TIME });
  new CronJob(env.CRON_TIME, () => {
    scan().catch((error) => {
      logger.error("Unhandled error in cron job", { error: error.message });
    });
  }).start();
}
