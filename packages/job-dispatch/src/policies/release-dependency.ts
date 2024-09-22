import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const isPassingReleaseDependencyPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];

  const jcs = await db
    .select()
    .from(schema.releaseJobTrigger)
    .leftJoin(
      schema.target,
      eq(schema.releaseJobTrigger.targetId, schema.target.id),
    )
    .leftJoin(
      schema.targetMetadata,
      eq(schema.targetMetadata.targetId, schema.target.id),
    )
    .leftJoin(
      schema.releaseDependency,
      eq(
        schema.releaseDependency.releaseId,
        schema.releaseJobTrigger.releaseId,
      ),
    )
    .leftJoin(
      schema.targetMetadataGroup,
      eq(
        schema.releaseDependency.targetMetadataGroupId,
        schema.targetMetadataGroup.id,
      ),
    )
    .where(
      inArray(
        schema.releaseJobTrigger.id,
        releaseJobTriggers.map((jc) => jc.id),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((row) => row.release_job_trigger.id)
        .map((jc) => ({
          releaseJobTrigger: jc[0]!.release_job_trigger,
          target: jc[0]!.target,
          releaseDependencies: _.chain(jc)
            .filter(
              (v) =>
                v.release_dependency != null && v.target_metadata_group != null,
            )
            .groupBy((v) => v.release_dependency!.id)
            .map((v) => ({
              releaseDependency: v[0]!.release_dependency!,
              targetMetadataGroup: v[0]!.target_metadata_group!,
            }))
            .value(),
          targetMetadata: _.chain(jc)
            .filter((v) => v.target_metadata != null)
            .groupBy((v) => v.target_metadata!.id)
            .map((v) => ({
              ...v[0]!.target_metadata!,
            }))
            .value(),
        }))
        .value(),
    );

  return Promise.all(
    jcs.map(async (jc) => {
      if (jc.releaseDependencies.length === 0 || jc.target == null)
        return jc.releaseJobTrigger;

      const { targetMetadata } = jc;

      const numDepsPassing = await Promise.all(
        jc.releaseDependencies.map(async (rd) => {
          const { releaseDependency: releaseDep, targetMetadataGroup: tlg } =
            rd;

          const relevantTargetMetadata = targetMetadata.filter((tm) =>
            tlg.keys.includes(tm.key),
          );

          const dependentJobs = await db
            .select()
            .from(schema.job)
            .innerJoin(
              schema.releaseJobTrigger,
              eq(schema.job.id, schema.releaseJobTrigger.jobId),
            )
            .innerJoin(
              schema.target,
              eq(schema.releaseJobTrigger.targetId, schema.target.id),
            )
            .innerJoin(
              schema.release,
              eq(schema.releaseJobTrigger.releaseId, schema.release.id),
            )
            .innerJoin(
              schema.deployment,
              eq(schema.release.deploymentId, schema.deployment.id),
            )
            .where(
              and(
                eq(schema.job.status, "completed"),
                eq(schema.deployment.id, releaseDep.deploymentId),
                schema.targetMatchesMetadata(db, {
                  type: "comparison",
                  operator: "and",
                  conditions: relevantTargetMetadata.map((tm) => ({
                    ...tm,
                    type: "metadata",
                  })),
                }),
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
