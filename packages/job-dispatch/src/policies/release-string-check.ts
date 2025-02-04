import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleasePolicyChecker } from "./utils.js";

/**
/**
 *
 * @param db
 * @param wf
 * @returns A promise that resolves to the release job triggers that pass the
 * regex or semver policy, if any.
 */
export const isPassingReleaseStringCheckPolicy: ReleasePolicyChecker = async (
  db,
  wf,
) => {
  const policyRCSubquery = db
    .select({
      releaseChannelPolicyId: schema.environmentPolicyReleaseChannel.policyId,
      releaseChannelDeploymentId: schema.releaseChannel.deploymentId,
      releaseChannelFilter: schema.releaseChannel.releaseFilter,
    })
    .from(schema.environmentPolicyReleaseChannel)
    .innerJoin(
      schema.releaseChannel,
      eq(
        schema.environmentPolicyReleaseChannel.channelId,
        schema.releaseChannel.id,
      ),
    )
    .as("policyRCSubquery");

  const envIds = wf.map((v) => v.environmentId).filter(isPresent);

  const envs = await db
    .select()
    .from(schema.environment)
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      policyRCSubquery,
      eq(policyRCSubquery.releaseChannelPolicyId, schema.environmentPolicy.id),
    )
    .where(inArray(schema.environment.id, envIds))
    .then((rows) =>
      _.chain(rows)
        .groupBy((row) => row.environment.id)
        .map((groupedRows) => ({
          environment: groupedRows[0]!.environment,
          policy: {
            ...groupedRows[0]!.environment_policy,
            releaseChannels: groupedRows
              .map((row) => row.policyRCSubquery)
              .filter(isPresent),
          },
        }))
        .value(),
    );

  const releaseIds = wf.map((v) => v.releaseId).filter(isPresent);
  const rels = await db
    .select()
    .from(schema.release)
    .where(inArray(schema.release.id, releaseIds));

  const promises = wf.map(async (wf) => {
    const env = envs.find((e) => e.environment.id === wf.environmentId);
    if (env == null) return null;

    const release = rels.find((r) => r.id === wf.releaseId);
    if (release == null) return null;

    const policyReleaseChannel = env.policy.releaseChannels.find(
      (rc) => rc.releaseChannelDeploymentId === release.deploymentId,
    );

    const { releaseChannelFilter } = policyReleaseChannel ?? {};
    if (releaseChannelFilter == null) return wf;

    const matchingRelease = await db
      .select()
      .from(schema.release)
      .where(
        and(
          eq(schema.release.id, release.id),
          schema.releaseMatchesCondition(db, releaseChannelFilter),
        ),
      )
      .then(takeFirstOrNull);

    return isPresent(matchingRelease) ? wf : null;
  });

  return Promise.all(promises).then((results) => results.filter(isPresent));
};
