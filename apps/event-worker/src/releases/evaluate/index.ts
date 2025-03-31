import type { ReleaseEvaluateEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import _ from "lodash";

import { db } from "@ctrlplane/db/client";
import { evaluate } from "@ctrlplane/rule-engine";
import { createCtx, getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Channel } from "@ctrlplane/validators/events";

import { ReleaseRepositoryMutex } from "../mutex.js";

export const createReleaseEvaluateWorker = () =>
  new Worker<ReleaseEvaluateEvent>(Channel.ReleaseEvaluate, async (job) => {
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
      const result = await evaluate(policy, [], ctx);
      console.log(result);
    } finally {
      await mutex.unlock();
    }
  });
