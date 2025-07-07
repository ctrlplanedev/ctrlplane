import type { Tx } from "@ctrlplane/db";

import { eq } from "@ctrlplane/db";
import { getResourceParents } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

const log = logger.child({
  module: "v1/jobs/[jobId]",
  function: "getJob",
});

const getRunbookJobResult = async (db: Tx, jobId: string) => {
  const runbookJobResult = await db.query.runbookJobTrigger.findFirst({
    where: eq(schema.runbookJobTrigger.jobId, jobId),
    with: { job: { with: { variables: true } } },
  });

  if (runbookJobResult == null) return null;

  const { job: jobResult } = runbookJobResult;
  const { variables, ...job } = jobResult;

  const jobVariables = Object.fromEntries(
    variables.map((variable) => {
      const { key, value, sensitive } = variable;
      const strval =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      const resolvedValue = sensitive
        ? variablesAES256().decrypt(strval)
        : value;
      return [key, resolvedValue];
    }),
  );

  return { ...job, variables: jobVariables };
};

export const getJobLinks = (
  metadata: Record<string, string>,
): Record<string, string> => {
  try {
    const links = JSON.parse(metadata["ctrlplane/links"] ?? "{}") as Record<
      string,
      string
    >;
    return links;
  } catch (error) {
    log.error("Error getting job links", {
      error,
      metadata,
    });
    return {};
  }
};

export const getJob = async (db: Tx, jobId: string) => {
  log.info("Getting job", { jobId });

  try {
    const runbookJobResult = await getRunbookJobResult(db, jobId);
    if (runbookJobResult != null) return runbookJobResult;

    const jobResult = await db.query.job.findFirst({
      where: eq(schema.job.id, jobId),
      with: {
        variables: true,
        metadata: true,
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
                    version: { with: { metadata: true } },
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
    const { metadata: versionMetadata } = version;
    const versionMetadataMap = Object.fromEntries(
      versionMetadata.map(({ key, value }) => [key, value]),
    );
    const versionWithMetadata = { ...version, metadata: versionMetadataMap };

    const { values } = variableSetRelease;
    const jobVariables = Object.fromEntries(
      job.variables.map((variable) => {
        const { key, value, sensitive } = variable;
        const strval =
          typeof value === "object" ? JSON.stringify(value) : String(value);
        const resolvedValue = sensitive
          ? variablesAES256().decrypt(strval)
          : value;
        return [key, resolvedValue];
      }),
    );

    const jobMetadata = Object.fromEntries(
      job.metadata.map(({ key, value }) => [key, value]),
    );

    const links = getJobLinks(jobMetadata);

    const { environment, resource, deployment } = releaseTarget;
    const { relationships } = await getResourceParents(db, resource.id);
    const metadata = Object.fromEntries(
      resource.metadata.map(({ key, value }) => [key, value]),
    );
    const resourceWithMetadata = {
      ...resource,
      metadata,
      relationships: Object.fromEntries(
        Object.entries(relationships).map(([key, { target, ...rule }]) => [
          key,
          { ...target, rule },
        ]),
      ),
    };

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
      links,
      variables: jobVariables,
      metadata: jobMetadata,
      resource: resourceWithMetadata,
      environment,
      deployment,
      version: versionWithMetadata,
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
