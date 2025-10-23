import type { EntityType, ScopeType } from "@ctrlplane/db/schema";
import _ from "lodash";

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
      on: async (...scopes: Array<{ type: ScopeType; id: string }>) => {
        const results = await _.chain(scopes)
          .map((scope) =>
            checkEntityPermissionForResource(
              { type: entityType, id },
              scope,
              permissions,
            ),
          )
          .thru((promises) => Promise.all(promises))
          .value();

        return results.every(Boolean);
      },
    }),
  });

export const can = (): CanFunction => ({
  user: createEntityPermissionChecker("user"),
  team: createEntityPermissionChecker("team"),
});
