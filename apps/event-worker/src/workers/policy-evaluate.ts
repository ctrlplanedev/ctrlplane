import _ from "lodash";

import { and, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import {
  DatabaseReleaseRepository,
  evaluateRepository,
} from "@ctrlplane/rule-engine";

import { ReleaseTargetMutex } from "../releases/mutex.js";

export const policyEvaluate = createWorker(
  Channel.EvaluateReleaseTarget,
  async (job) => {
    const mutex = await ReleaseTargetMutex.lock(job.data);
    try {
      const releaseTarget = await db.query.releaseTarget.findFirst({
        where: and(
          eq(schema.releaseTarget.resourceId, job.data.resourceId),
          eq(schema.releaseTarget.environmentId, job.data.environmentId),
          eq(schema.releaseTarget.deploymentId, job.data.deploymentId),
        ),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
      });
      if (releaseTarget == null)
        throw new Error("Failed to get release target");

      const releaseRepository = await DatabaseReleaseRepository.create({
        ...releaseTarget,
        workspaceId: releaseTarget.resource.workspaceId,
      });

      await evaluateRepository(releaseRepository);
    } finally {
      await mutex.unlock();
    }
  },
);
