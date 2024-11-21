import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

const schema = z.object({
  approvalRequirement: z.enum(["automatic", "manual"]),
  successType: z.enum(["all", "some", "optional"]),
  successMinimum: z.number().min(0, "Must be a positive number"),
});

export const ApprovalAndGovernance: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const form = useForm({ schema, defaultValues: { ...environmentPolicy } });
  const { successMinimum } = form.watch();

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

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-10 p-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Approval & Governance</h1>
          <span className="text-sm text-muted-foreground">
            This category defines policies that govern the oversight and
            approval process for deployments. These policies ensure that
            deployments meet specific criteria or gain necessary approvals
            before proceeding, contributing to compliance, quality assurance,
            and overall governance of the deployment process.
          </span>
        </div>

        <FormField
          control={form.control}
          name="approvalRequirement"
          render={({ field: { value, onChange } }) => (
            <FormItem className="space-y-4">
              <div className="flex flex-col gap-1">
                <FormLabel>Approval gates</FormLabel>
                <FormDescription>
                  If enabled, a release will require approval from an authorized
                  user before it can be deployed to any environment with this
                  policy.
                </FormDescription>
              </div>
              <FormControl>
                <div className="w-32">
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automatic">Automatic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="successType"
          render={({ field: { value, onChange } }) => (
            <FormItem className="space-y-4">
              <div className="flex flex-col gap-1">
                <FormLabel>Previous Deploy Status</FormLabel>
                <FormDescription>
                  Specify a minimum number of targets in dependent environments
                  to successfully be deployed to before triggering a release.
                  For example, specifying that all targets in QA must be
                  deployed to before releasing to PROD.
                </FormDescription>
              </div>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="all" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      All targets in dependent environments must complete
                      successfully
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="some" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      A minimum of{" "}
                      <Input
                        disabled={value !== "some"}
                        type="number"
                        value={successMinimum}
                        onChange={(e) =>
                          form.setValue(
                            "successMinimum",
                            e.target.valueAsNumber,
                          )
                        }
                        className="border-b-1 h-6 w-16 text-xs"
                      />
                      targets must be successfully deployed to
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="optional" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      No validation required
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />

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
