import type * as SCHEMA from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";

export const useUpdatePolicy = (
  environmentPolicy: SCHEMA.EnvironmentPolicy,
) => {
  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();
  const { id, systemId } = environmentPolicy;
  const invalidatePolicy = () => {
    utils.environment.policy.byId.invalidate(id);
    utils.environment.policy.bySystemId.invalidate(systemId);
  };

  const onUpdate = (data: SCHEMA.UpdateEnvironmentPolicy) =>
    updatePolicy.mutateAsync({ id, data }).then(invalidatePolicy);

  return {
    onUpdate,
    isUpdating: updatePolicy.isPending,
  };
};
