import type * as schema from "@ctrlplane/db/schema";
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

const releaseSequencingForm = z.object({
  releaseSequencing: z.enum(["wait", "cancel"]),
});

export const ReleaseSequencing: React.FC<{
  environmentPolicy: schema.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const form = useForm({
    schema: releaseSequencingForm,
    defaultValues: {
      releaseSequencing: environmentPolicy.releaseSequencing,
    },
  });

  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    updatePolicy
      .mutateAsync({
        id: environmentPolicy.id,
        data,
      })
      .then(() => form.reset(data))
      .then(() =>
        utils.environment.policy.byId.invalidate(environmentPolicy.id),
      ),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 p-2">
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
