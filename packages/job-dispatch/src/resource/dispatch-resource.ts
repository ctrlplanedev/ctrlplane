import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { handleEvent } from "../events/index.js";
import { dispatchReleaseJobTriggers } from "../job-dispatch.js";
import { isPassingAllPolicies } from "../policy-checker.js";
import { createJobApprovals } from "../policy-create.js";
import { createReleaseJobTriggers } from "../release-job-trigger.js";

const getEnvironmentWithReleaseChannels = (db: Tx, envId: string) =>
  db.query.environment.findFirst({
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

export async function dispatchJobsForAddedResources(
  db: Tx,
  resourceIds: string[],
  envId: string,
): Promise<void> {
  const environment = await getEnvironmentWithReleaseChannels(db, envId);
  if (environment == null) return;

  const { releaseChannels, policy, system } = environment;
  const { deployments } = system;
  const policyReleaseChannels = policy?.environmentPolicyReleaseChannels ?? [];
  const deploymentsWithReleaseFilter = deployments.map((deployment) => {
    const envReleaseChannel = releaseChannels.find(
      (erc) => erc.deploymentId === deployment.id,
    );
    const policyReleaseChannel = policyReleaseChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );

    const { releaseFilter } =
      envReleaseChannel?.releaseChannel ??
      policyReleaseChannel?.releaseChannel ??
      {};
    return { ...deployment, releaseFilter };
  });

  const releasePromises = deploymentsWithReleaseFilter.map(
    ({ id, releaseFilter }) =>
      db
        .select()
        .from(SCHEMA.release)
        .where(
          and(
            eq(SCHEMA.release.deploymentId, id),
            SCHEMA.releaseMatchesCondition(db, releaseFilter ?? undefined),
          ),
        )
        .orderBy(desc(SCHEMA.release.createdAt))
        .limit(1)
        .then(takeFirstOrNull),
  );

  const releases = await Promise.all(releasePromises).then((rows) =>
    rows.filter(isPresent),
  );
  if (releases.length === 0) return;

  const releaseJobTriggers = await createReleaseJobTriggers(db, "new_resource")
    .resources(resourceIds)
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

const getEnvironmentDeployments = (db: Tx, envId: string) =>
  db
    .select()
    .from(SCHEMA.deployment)
    .innerJoin(SCHEMA.system, eq(SCHEMA.deployment.systemId, SCHEMA.system.id))
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.system.id, SCHEMA.environment.systemId),
    )
    .where(eq(SCHEMA.environment.id, envId))
    .then((rows) => rows.map((r) => r.deployment));

export const dispatchJobsForRemovedResources = async (
  db: Tx,
  resourceIds: string[],
  envId: string,
): Promise<void> => {
  const deployments = await getEnvironmentDeployments(db, envId);
  if (deployments.length === 0) return;

  const resources = await db.query.resource.findMany({
    where: inArray(SCHEMA.resource.id, resourceIds),
  });

  const events = resources.flatMap((resource) =>
    deployments.map((deployment) => ({
      action: "deployment.resource.removed" as const,
      payload: { deployment, resource },
    })),
  );

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};
