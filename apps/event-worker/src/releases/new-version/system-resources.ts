import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

/**
 * Retrieves all resources for a given system by using environment selectors
 */
export const getSystemResources = async (tx: Tx, systemId: string) => {
  const system = await tx.query.system.findFirst({
    where: eq(schema.system.id, systemId),
    with: { environments: true },
  });

  if (system == null) throw new Error("System not found");

  const { environments } = system;

  // Simplify the chained operations with standard Promise.all
  const resources = await Promise.all(
    environments.map(async (env) => {
      const res = await tx
        .select()
        .from(schema.resource)
        .where(
          and(
            eq(schema.resource.workspaceId, system.workspaceId),
            schema.resourceMatchesMetadata(tx, env.resourceSelector),
          ),
        );
      return res.map((r) => ({ ...r, environment: env }));
    }),
  ).then((arrays) => arrays.flat());

  return resources;
};
