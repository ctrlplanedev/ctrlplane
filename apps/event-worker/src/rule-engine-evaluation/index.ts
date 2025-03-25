import type {
  DeploymentResourceContext,
  Release,
} from "@ctrlplane/rule-engine";
import type { RuleEngineEvaluationEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import { Mutex } from "redis-semaphore";

import { and, desc, eq, sql, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  Releases,
  RuleEngine,
  VersionCooldownRule,
} from "@ctrlplane/rule-engine";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis.js";

const createDeploymentResourceContext = ({
  resourceId,
  deploymentId,
  environmentId,
}: RuleEngineEvaluationEvent) => {
  return db
    .select({
      desiredReleaseId: schema.resourceDesiredRelease.desiredReleaseId,
      deployment: schema.deployment,
      environment: schema.environment,
      resource: schema.resource,
    })
    .from(schema.resourceDesiredRelease)
    .innerJoin(
      schema.deployment,
      eq(schema.resourceDesiredRelease.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.resourceDesiredRelease.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.resource,
      eq(schema.resourceDesiredRelease.resourceId, schema.resource.id),
    )
    .where(
      and(
        eq(schema.resourceDesiredRelease.resourceId, resourceId),
        eq(schema.resourceDesiredRelease.environmentId, environmentId),
        eq(schema.resourceDesiredRelease.deploymentId, deploymentId),
      ),
    )
    .then(takeFirstOrNull);
};

const getReleaseCandidates = async (
  ctx: DeploymentResourceContext,
): Promise<Release[]> => {
  return db
    .select({
      id: schema.release.id,
      createdAt: schema.release.createdAt,
      version: schema.deploymentVersion,
      variables: sql<Record<string, unknown>>`COALESCE(jsonb_object_agg(
              ${schema.releaseVariable.key},
              ${schema.releaseVariable.value}
            ) FILTER (WHERE ${schema.releaseVariable.key} IS NOT NULL), '{}'::jsonb)`.as(
        "variables",
      ),
    })
    .from(schema.release)
    .where(
      and(
        eq(schema.release.id, ctx.resource.id),
        eq(schema.release.environmentId, ctx.environment.id),
        eq(schema.release.deploymentId, ctx.deployment.id),
      ),
    )
    .innerJoin(
      schema.deploymentVersion,
      eq(schema.release.versionId, schema.deploymentVersion.id),
    )
    .leftJoin(
      schema.releaseVariable,
      and(
        eq(schema.release.id, schema.releaseVariable.releaseId),
        eq(schema.releaseVariable.sensitive, false),
      ),
    )
    .groupBy(
      schema.release.id,
      schema.release.createdAt,
      schema.deploymentVersion.id,
    )
    .orderBy(desc(schema.release.createdAt))
    .limit(100)
    .then((releases) =>
      releases.map((r) => ({
        ...r,
        version: {
          ...r.version,
          metadata: {} as Record<string, string>,
        },
      })),
    );
};

const versionCooldownRule = () =>
  new VersionCooldownRule({
    cooldownMinutes: 1440,
    getLastSuccessfulDeploymentTime: () => new Date(),
  });

export const createRuleEngineEvaluationWorker = () =>
  new Worker<RuleEngineEvaluationEvent>(
    Channel.RuleEngineEvaluation,
    async (job) => {
      const { resourceId, deploymentId, environmentId } = job.data;

      const key = `rule-engine-evaluation:${resourceId}-${deploymentId}-${environmentId}`;
      const mutex = new Mutex(redis, key);

      await mutex.acquire();
      try {
        const ctx = await createDeploymentResourceContext(job.data);
        if (ctx == null)
          throw new Error(
            "Resource desired release not found. Could not build context.",
          );

        const allReleaseCandidates = await getReleaseCandidates(ctx);

        const releases = Releases.from(allReleaseCandidates);
        if (releases.isEmpty()) return;

        const ruleEngine = new RuleEngine([versionCooldownRule()]);
        const result = await ruleEngine.evaluate(releases, ctx);

        console.log(result);
      } finally {
        await mutex.release();
      }
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 10,
    },
  );
