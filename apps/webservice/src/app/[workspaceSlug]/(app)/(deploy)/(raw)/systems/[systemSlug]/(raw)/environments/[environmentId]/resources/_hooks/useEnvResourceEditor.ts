"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { z } from "zod";

import { useForm } from "@ctrlplane/ui/form";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  isComparisonCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

const getSelector = (
  resourceSelector: ResourceCondition | null,
): ResourceCondition | undefined => {
  if (resourceSelector == null) return undefined;
  if (!isComparisonCondition(resourceSelector))
    return {
      type: ConditionType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [resourceSelector],
    };
  return resourceSelector;
};

const selectorForm = z.object({
  resourceSelector: resourceCondition.optional(),
});

/**
 * Hook for managing resource selector editing functionality for an environment
 *
 * @param environment - The environment object containing selector configuration
 * @returns Object containing:
 *  - form: Form instance for managing selector state
 *  - onSubmit: Handler for submitting selector changes that:
 *    1. Updates the environment with new selector
 *    2. Resets form with new data
 *    3. Invalidates relevant environment queries
 */
export const useEnvResourceEditor = (environment: SCHEMA.Environment) => {
  const update = api.environment.update.useMutation();

  const form = useForm({
    schema: selectorForm,
    defaultValues: {
      resourceSelector: getSelector(environment.resourceSelector),
    },
  });
  const utils = api.useUtils();
  const { resourceSelector: resourceSelector } = form.watch();
  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: { ...data, resourceSelector: resourceSelector ?? null },
      })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(() => utils.environment.byId.invalidate(environment.id)),
  );
  return { form, onSubmit };
};
