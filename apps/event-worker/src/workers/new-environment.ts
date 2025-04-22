import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const recomputeReleaseTargets = async (environment: schema.Environment) => {
  const computeBuilder = selector().compute();
  await computeBuilder.environments([environment]).resourceSelectors();
  const { systemId } = environment;
  const system = await db
    .select()
    .from(schema.system)
    .where(eq(schema.system.id, systemId))
    .then(takeFirst);
  const { workspaceId } = system;
  return computeBuilder.allResources(workspaceId).releaseTargets();
};

export const newEnvironmentWorker = createWorker(
  Channel.NewEnvironment,
  async (job) => {
    const { data: environment } = job;
    const releaseTargets = await recomputeReleaseTargets(environment);
    await dispatchEvaluateJobs(releaseTargets);
  },
);
