import type * as SCHEMA from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";

const useInvalidateQueries = (
  environmentId: string,
  systemId: string,
  policyId?: string,
) => {
  const utils = api.useUtils();
  const invalidateQueries = () => {
    utils.environment.policy.byId.invalidate(policyId);
    utils.environment.policy.bySystemId.invalidate(systemId);
    utils.environment.byId.invalidate(environmentId);
  };
  return invalidateQueries;
};

export const useCreateOverridePolicy = (environment: SCHEMA.Environment) => {
  const createPolicy = api.environment.policy.create.useMutation();
  const invalidateQueries = useInvalidateQueries(
    environment.id,
    environment.systemId,
  );

  const onCreate = (data: SCHEMA.UpdateEnvironmentPolicy) =>
    createPolicy
      .mutateAsync({
        environmentId: environment.id,
        ...environment,
        ...data,
      })
      .then(invalidateQueries);

  return {
    onCreate,
    isCreating: createPolicy.isPending,
  };
};

export const useUpdateOverridePolicy = (
  environment: SCHEMA.Environment,
  policy: SCHEMA.EnvironmentPolicy,
) => {
  const updatePolicy = api.environment.policy.update.useMutation();
  const invalidateQueries = useInvalidateQueries(
    environment.id,
    environment.systemId,
    policy.id,
  );

  const onUpdate = (data: SCHEMA.UpdateEnvironmentPolicy) =>
    updatePolicy
      .mutateAsync({
        id: policy.id,
        data,
      })
      .then(invalidateQueries);

  return {
    onUpdate,
    isUpdating: updatePolicy.isPending,
  };
};
