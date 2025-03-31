import type { Policy } from "@ctrlplane/rule-engine";
import type { ReleaseEvaluateEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import _ from "lodash";

import { and, desc, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
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
        // version. We need to account for upgrades and downgrades. put this
        // function in @ctrlplane/rule-engine/utils as we will call it elsewhere
        const getReleases = async (_: Policy) => {
          await db.query.release.findMany({
            where: and(
              eq(schema.release.deploymentId, ctx.deploymentId),
              eq(schema.release.resourceId, ctx.resourceId),
              eq(schema.release.environmentId, ctx.environmentId),
              // TODO: Apply the conditions, if it exists. Its part of the
              // policy pass into this function. We might not be able to use
              // dirzzle query pattern here.
              // schema.deploymentVersionMatchesCondition( tx,
              // ctx.deployment.versionSelector,
              // ),
            ),
            with: {
              version: true,
              variables: true,
            },
            orderBy: desc(schema.release.createdAt),
          });

          return [];
        };

        const result = await evaluate(policy, getReleases, ctx);
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
