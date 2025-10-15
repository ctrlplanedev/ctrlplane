import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";
import type { Span } from "@ctrlplane/logger";
import { isPresent } from "ts-is-present";

import {
  getResources,
  inArray,
  isResourceChanged,
  upsertResources,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { SpanStatusCode } from "@ctrlplane/logger";
import { getAffectedVariables } from "@ctrlplane/rule-engine";

import { eventDispatcher } from "../index.js";
import { createSpanWrapper } from "../span.js";
import { groupResourcesByHook } from "./group-resources-by-hook.js";

export type ResourceToInsert = Omit<
  InsertResource,
  "providerId" | "workspaceId"
> & {
  metadata?: Record<string, string>;
  variables?: Array<
    | { key: string; value: any; sensitive: boolean }
    | { key: string; reference: string; path: string[]; defaultValue?: any }
  >;
};

const getPreviousResources = (
  tx: Tx,
  workspaceId: string,
  toUpdate: ResourceToInsert[],
) => {
  if (toUpdate.length === 0) return [];
  return getResources()
    .withProviderMetadataAndVariables()
    .byIdentifiersAndWorkspaceId(
      tx,
      toUpdate.map((r) => r.identifier),
      workspaceId,
    );
};

export const handleResourceProviderScan = createSpanWrapper(
  "handleResourceProviderScan",
  async (
    span: Span,
    tx: Tx,
    workspaceId: string,
    providerId: string,
    resourcesToInsert: ResourceToInsert[],
  ) => {
    span.setAttribute("workspace.id", workspaceId);
    span.setAttribute("provider.id", providerId);
    span.setAttribute("resources.count", resourcesToInsert.length);

    try {
      const { toIgnore, toInsert, toUpdate, toDelete } =
        await groupResourcesByHook(
          tx,
          workspaceId,
          providerId,
          resourcesToInsert,
        );
      span.setAttribute("resources.toInsert", toInsert.length);
      span.setAttribute("resources.toUpdate", toUpdate.length);
      span.setAttribute("resources.toDelete", toDelete.length);

      const previousResources = await getPreviousResources(
        tx,
        workspaceId,
        toUpdate,
      );

      const previousVariables = Object.fromEntries(
        previousResources.map((r) => [r.identifier, r.variables]),
      );

      const [insertedResources, updatedResources] = await Promise.all([
        upsertResources(
          tx,
          workspaceId,
          toInsert.map((r) => ({ ...r, providerId })),
        ),
        upsertResources(
          tx,
          workspaceId,
          toUpdate.map((r) => ({ ...r, providerId })),
        ),
      ]);

      if (toDelete.length > 0) {
        const deletedResources = await tx
          .update(schema.resource)
          .set({ deletedAt: new Date() })
          .where(
            inArray(
              schema.resource.id,
              toDelete.map((r) => r.id),
            ),
          )
          .returning();
        await Promise.all(
          deletedResources.map((r) =>
            eventDispatcher.dispatchResourceDeleted(r),
          ),
        );
        span.setAttribute("resources.deleted", deletedResources.length);
      }

      const changedResources = updatedResources
        .map((r) => {
          const previous = previousResources.find(
            (pr) =>
              pr.identifier === r.identifier &&
              pr.workspaceId === r.workspaceId,
          );
          if (previous == null) return null;
          if (isResourceChanged(previous, r)) return { previous, current: r };
          return null;
        })
        .filter(isPresent);

      await Promise.all(
        changedResources.map(({ previous, current }) =>
          eventDispatcher.dispatchResourceUpdated(previous, current),
        ),
      );
      span.setAttribute("resources.changed", changedResources.length);

      await Promise.all(
        insertedResources.map((r) =>
          eventDispatcher.dispatchResourceCreated(r),
        ),
      );
      span.setAttribute("resources.inserted", insertedResources.length);

      for (const resource of insertedResources) {
        const { variables } = resource;
        for (const variable of variables)
          await eventDispatcher.dispatchResourceVariableCreated(variable);
      }

      for (const resource of updatedResources) {
        const { variables } = resource;
        const previousVars = previousVariables[resource.identifier] ?? [];

        const affectedVariables = getAffectedVariables(previousVars, variables);
        for (const variable of affectedVariables) {
          const prev = previousVariables[resource.identifier]?.find(
            (v) => v.key === variable.key,
          );
          if (prev != null)
            await eventDispatcher.dispatchResourceVariableUpdated(
              prev,
              variable,
            );
          if (prev == null)
            await eventDispatcher.dispatchResourceVariableCreated(variable);
        }
      }

      return {
        ignored: toIgnore,
        inserted: insertedResources,
        updated: updatedResources,
        deleted: toDelete,
      };
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: String(error),
      });
      throw error;
    }
  },
);
