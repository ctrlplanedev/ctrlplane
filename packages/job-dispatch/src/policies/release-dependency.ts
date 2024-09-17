import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, sql } from "@ctrlplane/db";
import {
  deployment,
  job,
  release,
  releaseDependency,
  releaseJobTrigger,
  target,
  targetLabelGroup,
} from "@ctrlplane/db/schema";

export const isPassingReleaseDependencyPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];

  const jcs = await db
    .select()
    .from(releaseJobTrigger)
    .leftJoin(target, eq(releaseJobTrigger.targetId, target.id))
    .leftJoin(
      releaseDependency,
      eq(releaseDependency.releaseId, releaseJobTrigger.releaseId),
    )
    .leftJoin(
      targetLabelGroup,
      eq(releaseDependency.targetLabelGroupId, targetLabelGroup.id),
    )
    .where(
      inArray(
        releaseJobTrigger.id,
        releaseJobTriggers.map((jc) => jc.id),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((row) => row.release_job_trigger.id)
        .map((jc) => ({
          releaseJobTrigger: jc[0]!.release_job_trigger,
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
        return jc.releaseJobTrigger;

      const t = jc.target;

      const numDepsPassing = await Promise.all(
        jc.releaseDependencies.map(async (rd) => {
          const { releaseDependency: releaseDep, targetLabelGroup: tlg } = rd;
          if (releaseDep == null || tlg == null) return true;

          const targetLabelsForGroup = _.chain(t.labels).pick(tlg.keys).value();

          const dependentJobs = await db
            .select()
            .from(job)
            .innerJoin(releaseJobTrigger, eq(job.id, releaseJobTrigger.jobId))
            .innerJoin(target, eq(releaseJobTrigger.targetId, target.id))
            .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
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

          return dependentJobs.some((je) =>
            releaseDep.ruleType === "semver"
              ? satisfies(je.release.version, releaseDep.rule)
              : new RegExp(releaseDep.rule).test(je.release.version),
          );
        }),
      ).then((data) => data.filter(Boolean).length);

      const isAllDependenciesMet =
        numDepsPassing === jc.releaseDependencies.length;
      return isAllDependenciesMet ? jc.releaseJobTrigger : null;
    }),
  ).then((v) => v.filter(isPresent));
};
