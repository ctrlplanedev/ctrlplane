import type { Tx } from "@ctrlplane/db";

import { and, eq, inArray, isNotNull, isNull, or } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

/**
 * Gets resources for a specific provider
 * @param tx - Database transaction
 * @param providerId - ID of the provider to get resources for
 * @param options - Options object
 * @param options.deleted - If true, returns deleted resources. If false, returns non-deleted resources
 * @returns Promise resolving to array of resources
 */
export const getResourcesByProvider = (
  tx: Tx,
  providerId: string,
  options: { deleted: boolean } = { deleted: false },
) =>
  tx
    .select()
    .from(schema.resource)
    .where(
      and(
        eq(schema.resource.providerId, providerId),
        options.deleted
          ? isNotNull(schema.resource.deletedAt)
          : isNull(schema.resource.deletedAt),
      ),
    );

/**
 * Gets resources matching the provided workspace IDs and identifiers
 * Can filter for either deleted or non-deleted resources
 *
 * @param tx - Database transaction
 * @param resources - Array of objects containing workspaceId and identifier to look up
 * @param options - Options object
 * @param options.deleted - If true, returns deleted resources. If false, returns non-deleted resources
 * @returns Promise resolving to array of matching resources
 */
export const getResourcesByWorkspaceIdAndIdentifier = (
  tx: Tx,
  resources: { workspaceId: string; identifier: string }[],
  options: { deleted: boolean } = { deleted: false },
) =>
  tx
    .select()
    .from(schema.resource)
    .where(
      or(
        ...resources.map((r) =>
          and(
            eq(schema.resource.workspaceId, r.workspaceId),
            eq(schema.resource.identifier, r.identifier),
            options.deleted
              ? isNotNull(schema.resource.deletedAt)
              : isNull(schema.resource.deletedAt),
          ),
        ),
      ),
    );

/**
 * Groups provided resources by workspace environments matching them
 *
 * @param tx - Database transaction
 * @param workspaceId - ID of the workspace to get environments for
 * @param resourceIdentifiers - Array of resource identifiers to look up
 * @returns Promise resolving to array of environments
 */
export const getEnvironmentsByResourceWithIdentifiers = (
  tx: Tx,
  workspaceId: string,
  resourceIdentifiers: string[],
) =>
  tx
    .select({
      id: schema.environment.id,
      resourceFilter: schema.environment.resourceFilter,
    })
    .from(schema.environment)
    .innerJoin(schema.system, eq(schema.environment.systemId, schema.system.id))
    .where(
      and(
        eq(schema.system.workspaceId, workspaceId),
        isNotNull(schema.environment.resourceFilter),
      ),
    )
    .then((envs) =>
      Promise.all(
        envs.map(async (env) => ({
          ...env,
          resources: await tx
            .select()
            .from(schema.resource)
            .where(
              and(
                inArray(schema.resource.identifier, resourceIdentifiers),
                eq(schema.resource.workspaceId, workspaceId),
                schema.resourceMatchesMetadata(tx, env.resourceFilter),
                isNull(schema.resource.deletedAt),
              ),
            ),
        })),
      ),
    );
