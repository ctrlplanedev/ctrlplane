import type * as SCHEMA from "@ctrlplane/db/schema";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";
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

import { api } from "~/trpc/react";

const isValidDuration = (str: string) => !isNaN(ms(str));

const schema = z.object({
  duration: z.string().refine(isValidDuration, {
    message: "Invalid duration pattern",
  }),
});

export const GradualRollouts: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const form = useForm({
    schema,
    defaultValues: { duration: prettyMilliseconds(environmentPolicy.duration) },
  });

  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const { id, systemId } = environmentPolicy;
  const onSubmit = form.handleSubmit((data) =>
    updatePolicy
      .mutateAsync({ id, data: { duration: ms(data.duration) } })
      .then(() => form.reset(data))
      .then(() => utils.environment.policy.byId.invalidate(id))
      .then(() => utils.environment.policy.bySystemId.invalidate(systemId)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-6 p-2">
        <FormField
          control={form.control}
          name="duration"
          render={({ field }) => (
            <FormItem className="space-y-4">
              <div className="flex flex-col gap-1">
                <FormLabel>Gradual Rollout</FormLabel>
                <FormDescription>
                  Enabling gradual rollouts will spread deployments out over a
                  given duration. A default duration of 0ms means that
                  deployments will be rolled out immediately.
                </FormDescription>
              </div>
              <FormControl>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Spread deployments out over
                    </span>
                    <Input
                      type="string"
                      {...field}
                      placeholder="1d"
                      className="border-b-1 h-6 w-16 text-xs"
                    />
                  </div>
                  <FormMessage />
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
