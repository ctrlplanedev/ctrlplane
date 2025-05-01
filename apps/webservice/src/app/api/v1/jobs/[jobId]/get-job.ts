import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

const log = logger.child({
  module: "v1/jobs/[jobId]",
  function: "getJob",
});

export const getJob = async (db: Tx, jobId: string) => {
  log.info("Getting job", { jobId });

  try {
    const jobResult = await db.query.job.findFirst({
      where: eq(schema.job.id, jobId),
      with: {
        releaseJob: {
          with: {
            release: {
              with: {
                variableSetRelease: {
                  with: {
                    values: {
                      with: {
                        variableValueSnapshot: true,
                      },
                    },
                  },
                },
                versionRelease: {
                  with: {
                    version: true,
                    releaseTarget: {
                      with: {
                        resource: {
                          with: { metadata: true },
                        },
                        deployment: true,
                        environment: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (jobResult == null) {
      log.warn("Job not found", { jobId });
      return null;
    }

    log.debug("Found job", {
      jobId,
      status: jobResult.status,
    });

    const { releaseJob, ...job } = jobResult;

    const { release } = releaseJob;

    const { versionRelease, variableSetRelease } = release;

    const { version, releaseTarget } = versionRelease;

    const { values } = variableSetRelease;
    const jobVariables = Object.fromEntries(
      values.map(({ variableValueSnapshot }) => {
        const { key, value, sensitive } = variableValueSnapshot;
        const strval = String(value);
        const resolvedValue = sensitive
          ? variablesAES256().decrypt(strval)
          : value;
        return [key, resolvedValue];
      }),
    );

    const { environment, resource, deployment } = releaseTarget;

    const metadata = Object.fromEntries(
      resource.metadata.map(({ key, value }) => [key, value]),
    );
    const resourceWithMetadata = { ...resource, metadata };

    log.debug("Successfully processed job data", {
      jobId,
      variableCount: values.length,
      resourceId: resource.id,
      environmentId: environment.id,
      deploymentId: deployment.id,
      versionId: version.id,
    });

    return {
      ...job,
      variables: jobVariables,
      resource: resourceWithMetadata,
      environment,
      deployment,
      version,
      release,
    };
  } catch (error) {
    log.error("Error getting job", {
      error,
      jobId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
};
