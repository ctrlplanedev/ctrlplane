import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import type { ReleasePolicyChecker } from "./utils.js";

type EnvReleaseChannel = {
  releaseChannelEnvId: string;
  releaseChannelDeploymentId: string;
  releaseChannelFilter: ReleaseCondition | null;
};

type PolicyReleaseChannel = {
  releaseChannelPolicyId: string;
  releaseChannelDeploymentId: string;
  releaseChannelFilter: ReleaseCondition | null;
};

type PolicyRow = {
  environment: schema.Environment;
  environment_policy: schema.EnvironmentPolicy | null;
  envRCSubquery: EnvReleaseChannel | null;
  policyRCSubquery: PolicyReleaseChannel | null;
};

const cleanPolicyRows = (rows: PolicyRow[]) =>
  _.chain(rows)
    .groupBy((e) => e.environment.id)
    .map((v) => ({
      environment: {
        ...v[0]!.environment,
        releaseChannels: v.map((e) => e.envRCSubquery).filter(isPresent),
      },
      environmentPolicy: v[0]!.environment_policy
        ? {
            ...v[0]!.environment_policy,
            releaseChannels: v.map((e) => e.policyRCSubquery).filter(isPresent),
          }
        : null,
    }))
    .value();

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
  const envRCSubquery = db
    .select({
      releaseChannelEnvId: schema.environmentReleaseChannel.environmentId,
      releaseChannelDeploymentId: schema.releaseChannel.deploymentId,
      releaseChannelFilter: schema.releaseChannel.releaseFilter,
    })
    .from(schema.environmentReleaseChannel)
    .innerJoin(
      schema.releaseChannel,
      eq(schema.environmentReleaseChannel.channelId, schema.releaseChannel.id),
    )
    .as("envRCSubquery");

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
    .leftJoin(
      envRCSubquery,
      eq(envRCSubquery.releaseChannelEnvId, schema.environment.id),
    )
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      policyRCSubquery,
      eq(policyRCSubquery.releaseChannelPolicyId, schema.environmentPolicy.id),
    )
    .where(
      and(
        inArray(schema.environment.id, envIds),
        isNull(schema.environment.deletedAt),
      ),
    )
    .then(cleanPolicyRows);

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

    const envReleaseChannel = env.environment.releaseChannels.find(
      (rc) => rc.releaseChannelDeploymentId === release.deploymentId,
    );

    const policyReleaseChannel = env.environmentPolicy?.releaseChannels.find(
      (rc) => rc.releaseChannelDeploymentId === release.deploymentId,
    );

    const releaseFilter =
      envReleaseChannel?.releaseChannelFilter ??
      policyReleaseChannel?.releaseChannelFilter;
    if (releaseFilter == null) return wf;

    const matchingRelease = await db
      .select()
      .from(schema.release)
      .where(
        and(
          eq(schema.release.id, release.id),
          schema.releaseMatchesCondition(db, releaseFilter),
        ),
      )
      .then(takeFirstOrNull);

    return isPresent(matchingRelease) ? wf : null;
  });

  return Promise.all(promises).then((results) => results.filter(isPresent));
};
