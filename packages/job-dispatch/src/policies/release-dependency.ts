import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import _ from "lodash";
import { satisfies } from "semver";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

export const isPassingReleaseDependencyPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];

  const passingReleasesJobTriggersPromises = releaseJobTriggers.map(
    async (trigger) => {
      const release = await db
        .select()
        .from(schema.release)
        .innerJoin(
          schema.releaseDependency,
          eq(schema.release.id, schema.releaseDependency.releaseId),
        )
        .where(eq(schema.release.id, trigger.releaseId));

      if (release.length === 0) return trigger;

      const deps = release.map((r) => r.release_dependency);

      const results = await db.execute(
        sql`
          WITH RECURSIVE reachable_relationships(id, visited, tr_id, source_id, target_id, type) AS (
            -- Base case: start with the given ID and no relationship
            SELECT 
                ${trigger.targetId}::uuid AS id, 
                ARRAY[${trigger.targetId}::uuid] AS visited,
                NULL::uuid AS tr_id,
                NULL::uuid AS source_id,
                NULL::uuid AS target_id,
                NULL::target_relationship_type AS type
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
            JOIN target_relationship tr ON tr.source_id = rr.id OR tr.target_id = rr.id
            WHERE
                NOT CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END = ANY(rr.visited)
        )
        SELECT DISTINCT tr_id AS id, source_id, target_id, type
        FROM reachable_relationships
        WHERE tr_id IS NOT NULL;
        `,
      );

      const relationships = results.rows.map((r) => ({
        id: String(r.id),
        sourceId: String(r.source_id),
        targetId: String(r.target_id),
        type: r.type as "associated_with" | "depends_on",
      }));

      const sourceIds = relationships.map((r) => r.sourceId);
      const targetIds = relationships.map((r) => r.targetId);

      const allIds = _.uniq([...sourceIds, ...targetIds]);

      const targets = await db.select().from(schema.target).innerJoin();
    },
  );
};
