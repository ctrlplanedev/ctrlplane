import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

/**
 * Dispatches jobs for new targets added to an environment.
 */
export async function dispatchJobsForNewResources(
  db: Tx,
  newResourceIds: string[],
  envId: string,
): Promise<void> {
  const releaseChannels = await db.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, envId),
    with: {
      releaseChannels: { with: { releaseChannel: true } },
      policy: {
        with: {
          environmentPolicyReleaseChannels: { with: { releaseChannel: true } },
        },
      },
      system: { with: { deployments: true } },
    },
  });
  if (releaseChannels == null) return;

  const envReleaseChannels = releaseChannels.releaseChannels;
  const policyReleaseChannels =
    releaseChannels.policy?.environmentPolicyReleaseChannels ?? [];
  const { deployments } = releaseChannels.system;

  const releasePromises = deployments.map(async (deployment) => {
    const envReleaseChannel = envReleaseChannels.find(
      (erc) => erc.deploymentId === deployment.id,
    );
    const policyReleaseChannel = policyReleaseChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );
    const { releaseFilter } =
      envReleaseChannel?.releaseChannel ??
      policyReleaseChannel?.releaseChannel ??
      {};
    return db
      .select()
      .from(SCHEMA.release)
      .where(
        and(
          eq(SCHEMA.release.deploymentId, deployment.id),
          SCHEMA.releaseMatchesCondition(db, releaseFilter ?? undefined),
        ),
      )
      .orderBy(desc(SCHEMA.release.createdAt))
      .limit(1)
      .then(takeFirstOrNull);
  });
  const releases = await Promise.all(releasePromises).then((rows) =>
    rows.filter(isPresent),
  );
  if (releases.length === 0) return;

  const releaseJobTriggers = await createReleaseJobTriggers(db, "new_resource")
    .resources(newResourceIds)
    .environments([envId])
    .releases(releases.map((r) => r.id))
    .then(createJobApprovals)
    .insert();
  if (releaseJobTriggers.length === 0) return;

  await dispatchReleaseJobTriggers(db)
    .filter(isPassingAllPolicies)
    .releaseTriggers(releaseJobTriggers)
    .dispatch();
}
