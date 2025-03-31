import type { ReleaseEvaluateEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { evaluate } from "@ctrlplane/rule-engine";
import { createCtx, getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../../redis.js";
import { ReleaseRepositoryMutex } from "../mutex.js";

export const createReleaseEvaluateWorker = () =>
  new Worker<ReleaseEvaluateEvent>(
    Channel.ReleaseEvaluate,
    async (job) => {
      job.log(
        `Evaluating release for deployment ${job.data.deploymentId} and resource ${job.data.resourceId}`,
      );

      const mutex = await ReleaseRepositoryMutex.lock(job.data);

      try {
        const ctx = await createCtx(db, job.data);
        if (ctx == null) {
          job.log(
            `Resource ${job.data.resourceId} not found for deployment ${job.data.deploymentId} and environment ${job.data.environmentId}`,
          );
          return;
        }

        const { workspaceId } = ctx.resource;
        const policy = await getApplicablePolicies(db, workspaceId, job.data);

        // TODO: Get the releases from the database. We will want to apply a
        // prefix if one exists (a deployment version channel selector). For now
        // just return releases from the latest deployed release to the current
        // version. We need to account for upgrades and downgrades.

        const result = await evaluate(policy, [], ctx);
        console.log(result);
      } finally {
        await mutex.unlock();
      }
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 100,
    },
  );
