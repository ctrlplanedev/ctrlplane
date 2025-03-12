import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const isPassingReleaseDependencyPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];

  const passingReleasesJobTriggersPromises = releaseJobTriggers.map(
    async (trigger) => {
      const release = await db
        .select()
        .from(schema.deploymentVersion)
        .innerJoin(
          schema.releaseDependency,
          eq(schema.deploymentVersion.id, schema.releaseDependency.releaseId),
        )
        .where(eq(schema.deploymentVersion.id, trigger.releaseId));

      if (release.length === 0) return trigger;

      const deps = release.map((r) => r.deployment_version_dependency);

      if (deps.length === 0) return trigger;

      const results = await db.execute(
        sql`
          WITH RECURSIVE reachable_relationships(id, visited, tr_id, source_id, target_id, type) AS (
            -- Base case: start with the given ID and no relationship
            SELECT 
                ${trigger.resourceId}::uuid AS id, 
                ARRAY[${trigger.resourceId}::uuid] AS visited,
                NULL::uuid AS tr_id,
                NULL::uuid AS source_id,
                NULL::uuid AS target_id,
                NULL::resource_relationship_type AS type
            UNION ALL
            -- Recursive case: find all relationships connected to the current set of IDs
            SELECT
                CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END AS id,
                rr.visited || CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END,
                tr.id AS tr_id,
                tr.source_id,
                tr.target_id,
                tr.type
            FROM reachable_relationships rr
            JOIN resource_relationship tr ON tr.source_id = rr.id OR tr.target_id = rr.id
            WHERE
                NOT CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END = ANY(rr.visited)                
                AND tr.target_id != ${trigger.resourceId}
        )
        SELECT DISTINCT tr_id AS id, source_id, target_id, type
        FROM reachable_relationships
        WHERE tr_id IS NOT NULL;
        `,
      );

      // db.execute does not return the types even if the sql`` is annotated with the type
      // so we need to cast them here
      const relationships = results.rows.map((r) => ({
        id: String(r.id),
        sourceId: String(r.source_id),
        targetId: String(r.target_id),
        type: r.type as "associated_with" | "depends_on",
      }));

      const sourceIds = relationships.map((r) => r.sourceId);
      const targetIds = relationships.map((r) => r.targetId);

      const allIds = _.uniq([...sourceIds, ...targetIds, trigger.resourceId]);

      const passingDepsPromises = deps.map(async (dep) => {
        const latestJobSubquery = db
          .select({
            id: schema.releaseJobTrigger.id,
            resourceId: schema.releaseJobTrigger.resourceId,
            releaseId: schema.releaseJobTrigger.releaseId,
            status: schema.job.status,
            createdAt: schema.job.createdAt,
            rank: sql<number>`ROW_NUMBER() OVER (
              PARTITION BY ${schema.releaseJobTrigger.resourceId}, ${schema.releaseJobTrigger.releaseId}
              ORDER BY ${schema.job.createdAt} DESC
            )`.as("rank"),
          })
          .from(schema.job)
          .innerJoin(
            schema.releaseJobTrigger,
            eq(schema.releaseJobTrigger.jobId, schema.job.id),
          )
          .as("latest_job");

        const resourceFulfillingDependency = await db
          .select()
          .from(schema.deploymentVersion)
          .innerJoin(
            schema.deployment,
            eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
          )
          .innerJoin(
            latestJobSubquery,
            eq(latestJobSubquery.releaseId, schema.deploymentVersion.id),
          )
          .where(
            and(
              schema.releaseMatchesCondition(db, dep.releaseFilter),
              eq(schema.deployment.id, dep.deploymentId),
              inArray(latestJobSubquery.resourceId, allIds),
              eq(latestJobSubquery.rank, 1),
              eq(latestJobSubquery.status, JobStatus.Successful),
            ),
          );

        const isPassing = resourceFulfillingDependency.length > 0;
        return isPassing ? dep : null;
      });

      const passingDeps = await Promise.all(passingDepsPromises).then((deps) =>
        deps.filter(isPresent),
      );

      const isPassingAllDeps = passingDeps.length === deps.length;
      return isPassingAllDeps ? trigger : null;
    },
  );

  const passingTriggers = await Promise.all(
    passingReleasesJobTriggersPromises,
  ).then((triggers) => triggers.filter(isPresent));

  return passingTriggers;
};
