import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const createTriggeredRunbookJob = async (
  db: Tx,
  runbook: schema.Runbook,
  variableValues: Record<string, any>,
): Promise<schema.Job> => {
  logger.info(`Triger triggered runbook job ${runbook.name}`, {
    runbook,
    variableValues,
  });

  if (runbook.jobAgentId == null)
    throw new Error("Cannot dispatch runbooks without agents.");

  const jobAgent = await db
    .select()
    .from(schema.jobAgent)
    .where(eq(schema.jobAgent.id, runbook.jobAgentId))
    .then(takeFirst);

  const job = await db
    .insert(schema.job)
    .values({
      jobAgentId: jobAgent.id,
      jobAgentConfig: _.merge(jobAgent.config, runbook.jobAgentConfig),
      status: JobStatus.Pending,
    })
    .returning()
    .then(takeFirst);

  await db
    .insert(schema.runbookJobTrigger)
    .values({ jobId: job.id, runbookId: runbook.id });

  logger.info(`Created triggered runbook job`, { jobId: job.id });

  const variables = Object.entries(variableValues).map(([key, value]) => ({
    key,
    value,
    jobId: job.id,
  }));

  if (variables.length > 0)
    await db.insert(schema.jobVariable).values(variables);

  return job;
};
