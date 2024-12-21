import type * as SCHEMA from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";

export const useInvalidatePolicy = (
  environmentPolicy: SCHEMA.EnvironmentPolicy,
) => {
  const utils = api.useUtils();
  const { id, systemId } = environmentPolicy;
  return () => {
    utils.environment.policy.byId.invalidate(id);
    utils.environment.policy.bySystemId.invalidate(systemId);
  };
};
