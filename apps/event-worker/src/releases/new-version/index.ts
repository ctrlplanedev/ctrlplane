import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import type { ReleaseNewVersionEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";
import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../../redis.js";
import { createAndEvaluateRelease } from "../create-release.js";
import { getDeploymentResources } from "../deployment-resources.js";

export const createReleaseNewVersionWorker = () =>
  new Worker<ReleaseNewVersionEvent>(
    Channel.ReleaseNewVersion,
    async (job) => {
      const version = await db.query.deploymentVersion.findFirst({
        where: eq(schema.deploymentVersion.id, job.data.versionId),
        with: { deployment: true },
      });

      if (version == null) throw new Error("Version not found");

      const { deployment } = version;

      const impactedResources = await getDeploymentResources(db, deployment);
      const releaseRepos: ReleaseRepository[] = impactedResources.map((r) => ({
        deploymentId: deployment.id,
        resourceId: r.id,
        environmentId: r.environment.id,
      }));

      job.log(`Creating ${releaseRepos.length} releases`);
      await Promise.allSettled(
        releaseRepos.map((repo) => createAndEvaluateRelease(repo, version.id)),
      );
      job.log(`Created ${releaseRepos.length} releases`);
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 100,
    },
  );
