import type * as SCHEMA from "@ctrlplane/db/schema";
import { addDays, addHours, addMinutes, format } from "date-fns";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { Checkbox } from "@ctrlplane/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  durationNumber: z.number().min(0).nullable(),
  durationUnit: z.enum(["minutes", "hours", "days"]).nullable(),
  removeExpiration: z.boolean(),
});

type OverviewProps = {
  environment: SCHEMA.Environment;
};

const getExpiresAt = (
  expiresAt: Date | null,
  durationNumber: number,
  durationUnit: "minutes" | "hours" | "days",
) => {
  const currExpiresAt = expiresAt ?? new Date();
  if (durationUnit === "minutes")
    return addMinutes(currExpiresAt, durationNumber);
  if (durationUnit === "hours") return addHours(currExpiresAt, durationNumber);
  return addDays(currExpiresAt, durationNumber);
};

export const Overview: React.FC<OverviewProps> = ({ environment }) => {
  const defaultValues = {
    ...environment,
    durationNumber: null,
    durationUnit: "hours" as const,
    removeExpiration: false,
  };
  const form = useForm({ schema, defaultValues });
  const update = api.environment.update.useMutation();
  const envOverride = api.job.trigger.create.byEnvId.useMutation();

  const utils = api.useUtils();

  const { id, systemId } = environment;
  const onSubmit = form.handleSubmit((data) => {
    const { durationNumber, durationUnit, removeExpiration } = data;
    const expiresAt = removeExpiration
      ? null
      : durationNumber != null && durationUnit != null
        ? getExpiresAt(environment.expiresAt, durationNumber, durationUnit)
        : environment.expiresAt;

    const envData = { ...data, expiresAt };

    const resetValues = {
      ...data,
      durationNumber: null,
      removeExpiration: false,
    };
    update
      .mutateAsync({ id, data: envData })
      .then(() => form.reset(resetValues))
      .then(() => utils.environment.bySystemId.invalidate(systemId))
      .then(() => utils.environment.byId.invalidate(id));
  });

  const currExpiresAt = environment.expiresAt;
  const { durationNumber, durationUnit, removeExpiration } = form.watch();

  const currentExpiration =
    currExpiresAt != null
      ? format(currExpiresAt, "MMM d, yyyy h:mm a")
      : "never";

  const newExpiration = removeExpiration
    ? "never"
    : durationNumber != null && durationUnit != null
      ? format(
          getExpiresAt(currExpiresAt, durationNumber, durationUnit),
          "MMM d, yyyy h:mm a",
        )
      : null;

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

        <div className="space-y-4">
          <Label>Environment expiration</Label>
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>Current expiration: {currentExpiration}</span>
            <span>New expiration: {newExpiration ?? "No change"}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            {currExpiresAt == null && <span>Environment expires in: </span>}
            {currExpiresAt != null && <span>Extend expiration by: </span>}
            <FormField
              control={form.control}
              name="durationNumber"
              render={({ field: { value, onChange } }) => (
                <FormItem className="w-16">
                  <FormControl>
                    <Input
                      type="number"
                      value={value ?? ""}
                      className="appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      onChange={(e) => {
                        const num = e.target.valueAsNumber;
                        if (Number.isNaN(num)) {
                          onChange(null);
                          return;
                        }
                        onChange(num);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationUnit"
              render={({ field: { value, onChange } }) => (
                <FormItem className="w-24">
                  <FormControl>
                    <Select
                      value={value ?? undefined}
                      onValueChange={onChange}
                      defaultValue="hours"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration unit..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="removeExpiration"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={value}
                      onCheckedChange={(v) => {
                        onChange(v);
                        if (v) form.setValue("durationNumber", null);
                      }}
                    />
                    <label htmlFor="removeExpiration" className="text-sm">
                      Remove expiration
                    </label>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

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
