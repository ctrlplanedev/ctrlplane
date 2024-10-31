import type * as SCHEMA from "@ctrlplane/db/schema";
import { IconX } from "@tabler/icons-react";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DateTimePicker } from "@ctrlplane/ui/datetime-picker";
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
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  expiresAt: z
    .date()
    .min(new Date(), "Expires at must be in the future")
    .optional(),
});

type OverviewProps = {
  environment: SCHEMA.Environment;
};

const isUsing12HourClock = (): boolean => {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
  };
  const formattedTime = new Intl.DateTimeFormat(undefined, options).format(
    date,
  );
  return formattedTime.includes("AM") || formattedTime.includes("PM");
};

export const Overview: React.FC<OverviewProps> = ({ environment }) => {
  const expiresAt = environment.expiresAt ?? undefined;
  const defaultValues = { ...environment, expiresAt };
  const form = useForm({ schema, defaultValues });
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const utils = api.useUtils();

  const { id, systemId } = environment;
  const onSubmit = form.handleSubmit((data) =>
    update
      .mutateAsync({ id, data })
      .then(() => form.reset(data))
      .then(() => utils.environment.bySystemId.invalidate(systemId))
      .then(() => utils.environment.byId.invalidate(id)),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Staging, Production, QA..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add a description..."
                  value={value ?? ""}
                  onChange={onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="expiresAt"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Expires at</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <DateTimePicker
                    value={value}
                    onChange={onChange}
                    granularity="minute"
                    hourCycle={isUsing12HourClock() ? 12 : 24}
                    className="w-60"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => onChange(undefined)}
                  >
                    <IconX className="h-4 w-4" />
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={update.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              envOverride
                .mutateAsync(id)
                .then(() => utils.environment.bySystemId.invalidate(systemId))
                .then(() => utils.environment.byId.invalidate(id))
            }
          >
            Override
          </Button>
        </div>
      </form>
    </Form>
  );
};
