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
      await api.PATCH("/v1/jobs/{jobId}", {
        params: {
          path: { jobId },
        },
        body: {
          status: "invalid_job_agent",
          message: "Job name not found in manifest.",
        },
      });
      return;
    }

    logger.info(`Creating job - ${namespace}/${name}`);
    await getBatchClient().createNamespacedJob(namespace, manifest);
    await api.PATCH("/v1/jobs/{jobId}", {
      params: {
        path: { jobId },
      },
      body: {
        status: "in_progress",
        externalId: `${namespace}/${name}`,
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
      error,
    });
    await api.PATCH("/v1/jobs/{jobId}", {
      params: {
        path: { jobId },
      },
      body: {
        status: "invalid_job_agent",
        message: error.body?.message || error.message,
      },
    });
  }
};

const spinUpNewJobs = async (agentId: string) => {
  try {
    const response = await api.GET("/v1/job-agents/{agentId}/queue/next", {
      params: {
        path: { agentId },
      },
    });
    if (response.data == undefined) return;
    const { jobs = [] } = response.data;

    logger.info(`Found ${jobs.length} job(s) to run.`);
    await Promise.allSettled(
      jobs.map(async (job) => {
        logger.info(`Running job ${job.id}`);
        logger.debug(`Job details:`, { job });
        try {
          const je = await api.GET("/v1/jobs/{jobId}", {
            params: {
              path: { jobId: job.id },
            },
          });
          if (je.data == null)
            throw new Error(`Failed to fetch job details for job ${job.id}`);

          if (
            typeof job.jobAgentConfig !== "object" ||
            !("manifest" in job.jobAgentConfig)
          )
            throw new Error("Job manifest is required");

          const manifest = renderManifest(job.jobAgentConfig.manifest, je.data);

          const namespace = manifest?.metadata?.namespace ?? env.KUBE_NAMESPACE;
          await api.POST("/v1/jobs/{jobId}/acknowledge", {
            params: {
              path: { jobId: job.id },
            },
          });
          await deployManifest(job.id, namespace, manifest);
        } catch (error: any) {
          logger.error(`Error processing job ${job.id}`, {
            error: error.message,
            stack: error.stack,
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
    throw error;
  }
};

const updateExecutionStatus = async (agentId: string) => {
  try {
    const response = await api.GET("/v1/job-agents/{agentId}/jobs/running", {
      params: {
        path: { agentId },
      },
    });
    if (response.data == undefined) return;
    const jobs = response.data;
    logger.info(`Found ${jobs.length} running execution(s)`);
    await Promise.allSettled(
      jobs.map(async (job) => {
        const [namespace, name] = job.externalId?.split("/") ?? [];
        if (namespace == null || name == null) {
          logger.error("Invalid external run ID", {
            jobId: job.id,
            externalId: job.externalId,
          });
          return;
        }

        logger.debug(`Checking status of ${namespace}/${name}`);
        try {
          const { status, message } = await getJobStatus(namespace, name);
          await api.PATCH(`/v1/jobs/{jobId}`, {
            params: {
              path: { jobId: job.id },
            },
            body: { status, message },
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
