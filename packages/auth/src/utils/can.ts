import type { EntityType, ScopeType } from "@ctrlplane/db/schema";
import _ from "lodash";
import { z } from "zod";

import { logger } from "@ctrlplane/logger";

import { checkEntityPermissionForResource } from "./rbac.js";

// New type definition
export type CanFunction = {
  user: (id: string) => PermissionChecker;
  team: (id: string) => PermissionChecker;
};

export type PermissionChecker = {
  perform: (...permissions: string[]) => {
    on: (...scopes: Array<{ type: ScopeType; id: string }>) => Promise<boolean>;
  };
};

const createEntityPermissionChecker =
  (entityType: EntityType) =>
  (id: string): PermissionChecker => ({
    perform: (...permissions: string[]) => ({
      on: (...scopes: Array<{ type: ScopeType; id: string }>) => {
        const uuidSchema = z.string().uuid();
        const isValidUuid = scopes.every(
          (scope) => uuidSchema.safeParse(scope.id).success,
        );
        if (!isValidUuid) {
          logger.error("All scope IDs must be valid UUIDs", { scopes });
          throw new Error("All scope IDs must be valid UUIDs");
        }

        return _.chain(scopes)
          .map((scope) =>
            checkEntityPermissionForResource(
              { type: entityType, id },
              scope,
              permissions,
            ),
          )
          .thru((promises) => Promise.all(promises))
          .value()
          .then((results) => results.every(Boolean));
      },
    }),
  });

export const can = (): CanFunction => ({
  user: createEntityPermissionChecker("user"),
  team: createEntityPermissionChecker("team"),
});
