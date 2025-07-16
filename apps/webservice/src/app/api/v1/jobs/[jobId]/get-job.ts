import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { eq, takeFirst } from "@ctrlplane/db";
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

const getJobVariables = (
  rows: { job_variable: schema.JobVariable | null }[],
) => {
  const variablesList = rows.map((row) => row.job_variable).filter(isPresent);
  return Object.fromEntries(
    variablesList.map((variable) => {
      const { key, value, sensitive } = variable;
      const strval =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      const resolvedValue = sensitive
        ? variablesAES256().decrypt(strval)
        : value;
      return [key, resolvedValue];
    }),
  );
};

const getJobMetadata = (
  rows: { job_metadata: schema.JobMetadata | null }[],
) => {
  const metadataList = rows.map((row) => row.job_metadata).filter(isPresent);
  return Object.fromEntries(metadataList.map(({ key, value }) => [key, value]));
};

const getJobFromDb = async (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.job)
    .leftJoin(schema.jobMetadata, eq(schema.jobMetadata.jobId, schema.job.id))
    .leftJoin(schema.jobVariable, eq(schema.jobVariable.jobId, schema.job.id))
    .where(eq(schema.job.id, jobId))
    .then((rows) => {
      const [first] = rows;
      if (first == null) return null;

      const { job } = first;
      const variables = getJobVariables(rows);
      const metadata = getJobMetadata(rows);
      const links = getJobLinks(metadata);

      return { ...job, variables, metadata, links };
    });

const getReleaseInfo = async (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.releaseJob)
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.deploymentVersion,
      eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseTarget.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.releaseTarget.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.releaseTarget.resourceId, schema.resource.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirst);

const getResourceWithMetadataAndRelationships = async (
  db: Tx,
  resource: schema.Resource,
) => {
  const metadataList = await db
    .select()
    .from(schema.resourceMetadata)
    .where(eq(schema.resourceMetadata.resourceId, resource.id));
  const metadata = Object.fromEntries(
    metadataList.map(({ key, value }) => [key, value]),
  );
  const { relationships } = await getResourceParents(db, resource.id);
  const resourceRelationships = Object.fromEntries(
    Object.entries(relationships).map(([key, { source, ...rule }]) => [
      key,
      { ...source, rule },
    ]),
  );
  return { ...resource, metadata, relationships: resourceRelationships };
};

const getVersionWithMetadata = async (
  db: Tx,
  version: schema.DeploymentVersion,
) => {
  const metadataList = await db
    .select()
    .from(schema.deploymentVersionMetadata)
    .where(eq(schema.deploymentVersionMetadata.versionId, version.id));
  const metadata = Object.fromEntries(
    metadataList.map(({ key, value }) => [key, value]),
  );
  return { ...version, metadata };
};

export const getJob = async (db: Tx, jobId: string) => {
  log.info("Getting job", { jobId });

  try {
    const runbookJobResult = await getRunbookJobResult(db, jobId);
    if (runbookJobResult != null) return runbookJobResult;

    const job = await getJobFromDb(db, jobId);
    if (job == null) {
      log.warn("Job not found", { jobId });
      return null;
    }

    const {
      resource,
      environment,
      deployment,
      deployment_version: version,
    } = await getReleaseInfo(db, jobId);

    const resourceWithMetadata = await getResourceWithMetadataAndRelationships(
      db,
      resource,
    );
    const versionWithMetadata = await getVersionWithMetadata(db, version);

    return {
      ...job,
      resource: resourceWithMetadata,
      environment,
      deployment,
      version: versionWithMetadata,
      release: versionWithMetadata,
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
