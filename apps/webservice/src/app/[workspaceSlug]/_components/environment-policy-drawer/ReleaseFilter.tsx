import type * as SCHEMA from "@ctrlplane/db/schema";
import type { VersionCheck } from "@ctrlplane/validators/environment-policies";
import _ from "lodash";
import { validRange } from "semver";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";
import {
  isFilterCheck,
  isNoneCheck,
  isRegexCheck,
  isSemverCheck,
} from "@ctrlplane/validators/environment-policies";
import {
  defaultCondition,
  isValidReleaseCondition,
  releaseCondition,
} from "@ctrlplane/validators/releases";

import { api } from "~/trpc/react";
import { ReleaseConditionRender } from "../release-condition/ReleaseConditionRender";

const isValidRegex = (str: string) => {
  try {
    new RegExp(str);
    return true;
  } catch {
    return false;
  }
};

const schema = z
  .object({
    evaluateWith: z.literal("regex"),
    evaluate: z.string().refine(isValidRegex, {
      message: "Invalid regex pattern",
    }),
  })
  .or(
    z.object({
      evaluateWith: z.literal("none"),
      evaluate: z.null(),
    }),
  )
  .or(
    z.object({
      evaluateWith: z.literal("semver"),
      evaluate: z
        .string()
        .refine((s) => validRange(s) !== null, "Invalid semver range"),
    }),
  )
  .or(
    z.object({
      evaluateWith: z.literal("filter"),
      evaluate: releaseCondition.refine(isValidReleaseCondition, {
        message: "Invalid release condition",
      }),
    }),
  );

export const ReleaseFilter: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const check: VersionCheck = { ...environmentPolicy };
  // schema complains about type mismatching unless we add type guards
  const defaultValues = _.merge(
    {},
    environmentPolicy,
    isFilterCheck(check) && { evaluate: check.evaluate },
    isNoneCheck(check) && { evaluate: check.evaluate },
    isSemverCheck(check) && { evaluate: check.evaluate },
    isRegexCheck(check) && { evaluate: check.evaluate },
  );

  const form = useForm({ schema, defaultValues });
  const { evaluateWith, evaluate } = form.watch();

  const policyUpdate = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const { id, systemId } = environmentPolicy;
  const onSubmit = form.handleSubmit((data) =>
    policyUpdate
      .mutateAsync({ id, data })
      .then(() => form.reset(data))
      .then(() => utils.environment.policy.byId.invalidate(id))
      .then(() => utils.environment.policy.bySystemId.invalidate(systemId)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 p-2">
        <FormField
          control={form.control}
          name="evaluateWith"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Evaluate With</FormLabel>
              <RadioGroup onValueChange={onChange} value={value}>
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="none" />
                  </FormControl>
                  <FormLabel className="flex items-center gap-2 font-normal">
                    None
                  </FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="regex" />
                  </FormControl>
                  <FormLabel className="flex items-center gap-2 font-normal">
                    Regex
                  </FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="semver" />
                  </FormControl>
                  <FormLabel className="flex items-center gap-2 font-normal">
                    Semver
                  </FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-3 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="filter" />
                  </FormControl>
                  <FormLabel className="flex items-center gap-2 font-normal">
                    Filter
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormItem>
          )}
        />

        {evaluateWith === "regex" && (
          <FormField
            control={form.control}
            name="evaluate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regex</FormLabel>
                <Input {...field} placeholder="^v[0-9]+.[0-9]+.[0-9]+$" />
              </FormItem>
            )}
          />
        )}

        {evaluateWith === "semver" && (
          <FormField
            control={form.control}
            name="evaluate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Semver</FormLabel>
                <Input {...field} placeholder=">=v1.0.0" />
              </FormItem>
            )}
          />
        )}

        {evaluateWith === "filter" && (
          <FormField
            control={form.control}
            name="evaluate"
            render={({ field: { onChange } }) => (
              <FormItem>
                <FormLabel>Filter</FormLabel>
                <FormControl>
                  <ReleaseConditionRender
                    condition={evaluate ?? defaultCondition}
                    onChange={onChange}
                  />
                </FormControl>
                <FormMessage />
                {form.formState.isDirty && (
                  <span className="text-xs text-muted-foreground">
                    Save to apply
                  </span>
                )}
              </FormItem>
            )}
          />
        )}

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={policyUpdate.isPending || !form.formState.isDirty}
          >
            Save
          </Button>

          {evaluateWith === "filter" && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => form.setValue("evaluate", defaultCondition)}
            >
              Clear
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
