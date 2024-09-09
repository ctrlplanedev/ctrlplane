import type { Tx } from "@ctrlplane/db";
import { sql } from "@ctrlplane/db";
import { release } from "@ctrlplane/db/schema";

export const latestReleaseSubQuery = (db: Tx) =>
  db
    .select({
      id: release.id,
      deploymentId: release.deploymentId,
      version: release.version,
      createdAt: release.createdAt,

      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY deployment_id ORDER BY created_at DESC)`.as(
        "rank",
      ),
    })
    .from(release)
    .as("release");
