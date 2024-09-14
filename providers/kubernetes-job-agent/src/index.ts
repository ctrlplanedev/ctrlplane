import { CronJob } from "cron";
import handlebars from "handlebars";
import yaml from "js-yaml";

import { logger } from "@ctrlplane/logger";

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
      });
      await api.updateJob({
        executionId: jobId,
        updateJobRequest: {
          status: "invalid_job_agent",
          message: "Job name not found in manifest.",
        },
      });
      return;
    }

    logger.info(`Creating job - ${namespace}/${name}`);
    await getBatchClient().createNamespacedJob(namespace, manifest);
    await api.updateJob({
      executionId: jobId,
      updateJobRequest: {
        status: "in_progress",
        externalRunId: `${namespace}/${name}`,
        message: "Job created successfully.",
      },
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
      error: error.message,
    });
    await api.updateJob({
      executionId: jobId,
      updateJobRequest: {
        status: "invalid_job_agent",
        message: error.body?.message || error.message,
      },
    });
  }
};

const spinUpNewJobs = async (agentId: string) => {
  try {
    const { jobs = [] } = await api.getNextJobs({ agentId });
    logger.info(`Found ${jobs.length} job(s) to run.`);
    await Promise.allSettled(
      jobs.map(async (job) => {
        logger.info(`Running job ${job.id}`);
        try {
          const je = await api.getJob({
            executionId: job.id,
          });
          const manifest = renderManifest(
            (job.jobAgentConfig as any).manifest,
            je,
          );
          const namespace = manifest?.metadata?.namespace ?? env.KUBE_NAMESPACE;
          await api.acknowledgeJob({ executionId: job.id });
          await deployManifest(job.id, namespace, manifest);
        } catch (error: any) {
          logger.error(`Error processing job ${job.id}`, {
            error: error.message,
          });
          throw error;
        }
      }),
    );
  } catch (error: any) {
    logger.error("Error spinning up new jobs", {
      agentId,
      error: error.message,
    });
  }
};

const updateExecutionStatus = async (agentId: string) => {
  try {
    const executions = await api.getAgentRunningExecutions({ agentId });
    logger.info(`Found ${executions.length} running execution(s)`);
    await Promise.allSettled(
      executions.map(async (exec) => {
        const [namespace, name] = exec.externalRunId?.split("/") ?? [];
        if (namespace == null || name == null) {
          logger.error("Invalid external run ID", {
            executionId: exec.id,
            externalRunId: exec.externalRunId,
          });
          return;
        }

        logger.debug(`Checking status of ${namespace}/${name}`);
        try {
          const { status, message } = await getJobStatus(namespace, name);
          await api.updateJob({
            executionId: exec.id,
            updateJobRequest: { status, message },
          });
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
    const { id } = await api.updateJobAgent({
      workspace: env.CTRLPLANE_WORKSPACE,
      updateJobAgentRequest: {
        name: env.CTRLPLANE_AGENT_NAME,
        type: "kubernetes-job",
      },
    });

    logger.info(`Agent ID: ${id}`);
    await spinUpNewJobs(id);
    await updateExecutionStatus(id);
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
