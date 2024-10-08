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
import { Switch } from "@ctrlplane/ui/switch";

import { api } from "~/trpc/react";

const schema = z.object({
  approvalRequirement: z.enum(["automatic", "manual"]),
});

export const Approval: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const form = useForm({ schema, defaultValues: { ...environmentPolicy } });

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
      <form onSubmit={onSubmit} className="space-y-6 p-2">
        <FormField
          control={form.control}
          name="approvalRequirement"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <div className="space-y-1">
                <FormLabel>Approval gates</FormLabel>
                <FormDescription>
                  If enabled, a release will require approval from an authorized
                  user before it can be deployed to any environment with this
                  policy.
                </FormDescription>
              </div>
              <FormControl>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">Enabled:</span>{" "}
                  <Switch
                    checked={value === "manual"}
                    onCheckedChange={(checked) =>
                      onChange(checked ? "manual" : "automatic")
                    }
                  />
                </div>
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
