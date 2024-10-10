import type * as SCHEMA from "@ctrlplane/db/schema";
import type { VersionCheck } from "@ctrlplane/validators/environment-policies";
import React from "react";
import _ from "lodash";
import { validRange } from "semver";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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

const filterSchema = z
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

const schema = z
  .object({
    concurrencyType: z.enum(["all", "some"]),
    concurrencyLimit: z.number().min(1, "Must be a positive number"),
  })
  .and(filterSchema);

export const DeploymentControl: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const check: VersionCheck = { ...environmentPolicy };
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

  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const { id, systemId } = environmentPolicy;
  const onSubmit = form.handleSubmit((data) =>
    updatePolicy
      .mutateAsync({ id, data })
      .then(() => form.reset(data))
      .then(() => utils.environment.policy.byId.invalidate(id))
      .then(() => utils.environment.policy.bySystemId.invalidate(systemId)),
  );

  const onEvaluateChange = (v: string) => {
    if (v === "none") form.setValue("evaluate", null);
    if (v === "filter") form.setValue("evaluate", defaultCondition);
    if (v === "regex" || v === "semver") form.setValue("evaluate", "");
  };

  const { concurrencyLimit } = form.watch();

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-10 p-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Deployment Control</h1>
          <span className="text-sm text-muted-foreground">
            Deployment control policies focus on regulating how deployments are
            executed within an environment. These policies manage concurrency,
            filtering of releases, and other operational constraints, ensuring
            efficient and orderly deployment processes without overwhelming
            resources or violating environment-specific rules.
          </span>
        </div>
        <FormField
          control={form.control}
          name="concurrencyType"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <FormLabel>Concurrency</FormLabel>
                  <FormDescription>
                    The number of jobs that can run concurrently in an
                    environment.
                  </FormDescription>
                </div>
                <FormControl>
                  <RadioGroup value={value} onValueChange={onChange}>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="all" />
                      </FormControl>
                      <FormLabel className="flex items-center gap-2 font-normal">
                        All jobs can run concurrently
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="some" className="min-w-4" />
                      </FormControl>
                      <FormLabel className="flex flex-wrap items-center gap-2 font-normal">
                        A maximum of
                        <Input
                          disabled={value !== "some"}
                          type="number"
                          value={concurrencyLimit}
                          onChange={(e) =>
                            form.setValue(
                              "concurrencyLimit",
                              e.target.valueAsNumber,
                            )
                          }
                          className="border-b-1 h-6 w-16 text-xs"
                        />
                        jobs can run concurrently
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
              </div>
            </FormItem>
          )}
        />

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="evaluateWith"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <div className="flex flex-col gap-1">
                  <FormLabel>Release Filter</FormLabel>
                  <FormDescription>
                    Filter which releases can be deployed to this environment.
                  </FormDescription>
                </div>
                <RadioGroup
                  onValueChange={(v) => {
                    onEvaluateChange(v);
                    onChange(v);
                  }}
                  value={value}
                >
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
        </div>

        <Button
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          Save
        </Button>
      </form>
    </Form>
  );
};
