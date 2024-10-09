import type * as SCHEMA from "@ctrlplane/db/schema";
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
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";

import { api } from "~/trpc/react";

const schema = z.object({ releaseSequencing: z.enum(["wait", "cancel"]) });

export const ReleaseManagement: React.FC<{
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
      <form onSubmit={onSubmit} className="space-y-10 p-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Release Management</h1>
          <span className="text-sm text-muted-foreground">
            Release management policies are concerned with how new and pending
            releases are handled within the deployment pipeline. These include
            defining sequencing rules, such as whether to cancel or await
            pending releases when a new release is triggered, ensuring that
            releases happen in a controlled and predictable manner without
            conflicts or disruptions.
          </span>
        </div>
        <FormField
          control={form.control}
          name="releaseSequencing"
          render={({ field: { value, onChange } }) => (
            <FormItem className="space-y-4">
              <div className="flex flex-col gap-1">
                <FormLabel>Release Sequencing</FormLabel>
                <FormDescription>
                  Specify whether pending releases should be cancelled or
                  awaited when a new release is triggered.
                </FormDescription>
              </div>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="wait" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      Pause deployment until active releases are completed
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="cancel" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      Cancel pending releases
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
