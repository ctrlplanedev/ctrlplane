"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { z } from "zod";

import { useForm } from "@ctrlplane/ui/form";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  isComparisonCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";

import { api } from "~/trpc/react";

const getSelector = (
  resourceFilter: ResourceCondition | null,
): ResourceCondition | undefined => {
  if (resourceFilter == null) return undefined;
  if (!isComparisonCondition(resourceFilter))
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      not: false,
      conditions: [resourceFilter],
    };
  return resourceFilter;
};

const selectorForm = z.object({
  resourceFilter: resourceCondition.optional(),
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
      resourceFilter: getSelector(environment.resourceFilter),
    },
  });
  const utils = api.useUtils();
  const { resourceFilter } = form.watch();
  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({
        id: environment.id,
        data: { ...data, resourceFilter: resourceFilter ?? null },
      })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(environment.systemId))
      .then(() => utils.environment.byId.invalidate(environment.id)),
  );
  return { form, onSubmit };
};
