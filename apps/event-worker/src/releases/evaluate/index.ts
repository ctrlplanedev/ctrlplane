import type { Policy } from "@ctrlplane/rule-engine";
import type { ReleaseEvaluateEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { db } from "@ctrlplane/db/client";
import { evaluate, getReleases } from "@ctrlplane/rule-engine";
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
        const getReleasesWithContext = (policy: Policy) =>
          getReleases(db, ctx, policy);

        const result = await evaluate(policy, getReleasesWithContext, ctx);
        console.log(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        job.log(`Error evaluating release: ${message}`);
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
