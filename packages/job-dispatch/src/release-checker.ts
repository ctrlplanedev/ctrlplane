import type { Tx } from "@ctrlplane/db";
import type { JobConfig, JobConfigInsert } from "@ctrlplane/db/schema";
import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, sql } from "@ctrlplane/db";
import {
  deployment,
  environment,
  environmentPolicy,
  job,
  jobConfig,
  release,
  releaseDependency,
  target,
  targetLabelGroup,
} from "@ctrlplane/db/schema";

/**
 *
 * @param db
 * @param wf
 * @returns A promise that resolves to the job configs that pass the regex or semver policy, if any.
 */
export const isPassingEnvironmentPolicy = async (
  db: Tx,
  wf: JobConfigInsert[],
) => {
  const envIds = wf.map((v) => v.environmentId).filter(isPresent);
  const policies = await db
    .select()
    .from(environment)
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(and(inArray(environment.id, envIds), isNull(environment.deletedAt)));

  const releaseIds = wf.map((v) => v.releaseId).filter(isPresent);
  const rels = await db
    .select()
    .from(release)
    .where(inArray(release.id, releaseIds));

  return wf.filter((v) => {
    const policy = policies.find((p) => p.environment.id === v.environmentId);
    if (policy == null) return true;

    const rel = rels.find((r) => r.id === v.releaseId);
    if (rel == null) return true;

    const { environment_policy: envPolicy } = policy;
    if (envPolicy.evaluateWith === "semver")
      return satisfies(rel.version, policy.environment_policy.evaluate);

    if (envPolicy.evaluateWith === "regex")
      return new RegExp(policy.environment_policy.evaluate).test(rel.version);

    return true;
  });
};

export const isPassingReleaseDependencyPolicy = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  if (jobConfigs.length === 0) return [];

  const jcs = await db
    .select()
    .from(jobConfig)
    .leftJoin(target, eq(jobConfig.targetId, target.id))
    .leftJoin(
      releaseDependency,
      eq(releaseDependency.releaseId, jobConfig.releaseId),
    )
    .leftJoin(
      targetLabelGroup,
      eq(releaseDependency.targetLabelGroupId, targetLabelGroup.id),
    )
    .where(
      inArray(
        jobConfig.id,
        jobConfigs.map((jc) => jc.id),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy("job_config.id")
        .map((jc) => ({
          jobConfig: jc[0]!.job_config,
          target: jc[0]!.target,
          releaseDependencies: jc
            .map((v) => ({
              releaseDependency: v.release_dependency,
              targetLabelGroup: v.target_label_group,
            }))
            .filter((v) => v.releaseDependency != null),
        }))
        .value(),
    );

  return Promise.all(
    jcs.map(async (jc) => {
      if (jc.releaseDependencies.length === 0 || jc.target == null)
        return jc.jobConfig;

      const t = jc.target;

      const numDepsPassing = await Promise.all(
        jc.releaseDependencies.map(async (rd) => {
          const { releaseDependency: releaseDep, targetLabelGroup: tlg } = rd;
          if (releaseDep == null || tlg == null) return true;

          const targetLabelsForGroup = _.chain(t.labels).pick(tlg.keys).value();

          const dependentJobExecutions = await db
            .select()
            .from(job)
            .innerJoin(jobConfig, eq(job.jobConfigId, jobConfig.id))
            .innerJoin(target, eq(jobConfig.targetId, target.id))
            .innerJoin(release, eq(jobConfig.releaseId, release.id))
            .innerJoin(deployment, eq(release.deploymentId, deployment.id))
            .where(
              and(
                eq(job.status, "completed"),
                eq(deployment.id, releaseDep.deploymentId),
                sql.raw(
                  `
              "target"."labels" @> jsonb_build_object(${Object.entries(
                targetLabelsForGroup,
              )
                .map(([k, v]) => `'${k}', '${v}'`)
                .join(",")})
              `,
                ),
              ),
            );

          return dependentJobExecutions.some((je) =>
            releaseDep.ruleType === "semver"
              ? satisfies(je.release.version, releaseDep.rule)
              : new RegExp(releaseDep.rule).test(je.release.version),
          );
        }),
      ).then((data) => data.filter(Boolean).length);

      const isAllDependenciesMet =
        numDepsPassing === jc.releaseDependencies.length;
      return isAllDependenciesMet ? jc.jobConfig : null;
    }),
  ).then((v) => v.filter(isPresent));
};
