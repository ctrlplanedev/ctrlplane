import type { EntityType, ScopeType } from "@ctrlplane/db/schema";

import { checkEntityPermissionForResource } from "./rbac";

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
      on: (...scopes: Array<{ type: ScopeType; id: string }>) =>
        Promise.all(
          scopes.map((scope) =>
            checkEntityPermissionForResource(
              { type: entityType, id },
              scope,
              permissions,
            ),
          ),
        ).then((results) => results.every(Boolean)),
    }),
  });

export const can = (): CanFunction => ({
  user: createEntityPermissionChecker("user"),
  team: createEntityPermissionChecker("team"),
});
