import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

export const createJobsForNewEnvironment = async (
  db: Tx,
  env: SCHEMA.Environment,
) => {
  const { resourceFilter } = env;
  if (resourceFilter == null) return;

  const releaseChannels = await db.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, env.id),
    with: {
      policy: {
        with: {
          environmentPolicyReleaseChannels: { with: { releaseChannel: true } },
        },
      },
      system: { with: { deployments: true } },
    },
  });
  if (releaseChannels == null) return;

  const { system, policy } = releaseChannels;
  const { workspaceId, deployments } = system;
  const { environmentPolicyReleaseChannels } = policy;

  const resources = await db
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.workspaceId, workspaceId),
        SCHEMA.resourceMatchesMetadata(db, resourceFilter),
        isNull(SCHEMA.resource.deletedAt),
      ),
    );
  if (resources.length === 0) return;

  const releasePromises = deployments.map(async (deployment) => {
    const channel = environmentPolicyReleaseChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );
    const { releaseFilter } = channel?.releaseChannel ?? {};
    return db
      .select()
      .from(SCHEMA.deploymentVersion)
      .where(
        and(
          eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
          SCHEMA.releaseMatchesCondition(db, releaseFilter ?? undefined),
        ),
      )
      .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
      .limit(1)
      .then(takeFirstOrNull);
  });
  const releases = await Promise.all(releasePromises).then((rows) =>
    rows.filter(isPresent),
  );
  if (releases.length === 0) return;

  const releaseJobTriggers = await createReleaseJobTriggers(
    db,
    "new_environment",
  )
    .environments([env.id])
    .resources(resources.map((t) => t.id))
    .releases(releases.map((r) => r.id))
    .then(createJobApprovals)
    .insert();
  if (releaseJobTriggers.length === 0) return;

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};
