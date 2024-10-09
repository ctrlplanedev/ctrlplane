import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { ZonedDateTime } from "@internationalized/date";
import { IconX } from "@tabler/icons-react";
import _ from "lodash";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DateTimePicker } from "@ctrlplane/ui/date-time-picker/date-time-picker";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFieldArray,
  useForm,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";

import { api } from "~/trpc/react";

const toZonedDateTime = (date: Date): ZonedDateTime => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -date.getTimezoneOffset() * ms("1m");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  const millisecond = date.getMilliseconds();

  return new ZonedDateTime(
    year,
    month,
    day,
    timeZone,
    offset,
    hour,
    minute,
    second,
    millisecond,
  );
};

const isValidDuration = (str: string) => !isNaN(ms(str));

const schema = z.object({
  releaseWindows: z.array(
    z.object({
      policyId: z.string().uuid(),
      recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
      startTime: z.date(),
      endTime: z.date(),
    }),
  ),
  duration: z.string().refine(isValidDuration, {
    message: "Invalid duration pattern",
  }),
});

export const RolloutAndTiming: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy & {
    releaseWindows: SCHEMA.EnvironmentPolicyReleaseWindow[];
  };
}> = ({ environmentPolicy }) => {
  const duration = prettyMilliseconds(environmentPolicy.duration);
  const form = useForm({
    schema,
    defaultValues: { ...environmentPolicy, duration },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "releaseWindows",
  });

  const setPolicyWindows = api.environment.policy.setWindows.useMutation();
  const updatePolicy = api.environment.policy.update.useMutation();
  const utils = api.useUtils();

  const { id: policyId, systemId } = environmentPolicy;
  const onSubmit = form.handleSubmit(async (data) => {
    const { releaseWindows, duration: durationString } = data;
    const duration = ms(durationString);
    await setPolicyWindows.mutateAsync({ policyId, releaseWindows });
    await updatePolicy.mutateAsync({ id: policyId, data: { duration } });

    form.reset(data);
    await utils.environment.policy.byId.invalidate(policyId);
    await utils.environment.policy.bySystemId.invalidate(systemId);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-10 p-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Rollout and Timing</h1>
          <span className="text-sm text-muted-foreground">
            Rollout and timing policies govern how and when deployments are
            rolled out to environments. These include incremental rollout
            strategies, scheduling deployments during specific windows, and
            managing release timing to minimize risk and ensure stability during
            the deployment process.
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <Label>Release Windows</Label>
            <span className="text-xs text-muted-foreground">
              Release windows allow you to control when deployments can be
              released into an environment.
            </span>
          </div>

          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((field, index) => {
                return (
                  <FormField
                    control={form.control}
                    key={field.id}
                    name={`releaseWindows.${index}`}
                    render={({ field: { value, onChange } }) => {
                      return (
                        <div
                          key={index}
                          className="flex w-fit items-center gap-2 rounded-md border p-1 text-sm"
                        >
                          <DateTimePicker
                            value={toZonedDateTime(value.startTime)}
                            aria-label="Start Time"
                            onChange={(t) => {
                              onChange({
                                ...value,
                                startTime: t.toDate(
                                  Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone,
                                ),
                              });
                            }}
                          />{" "}
                          <span className="text-muted-foreground">to</span>{" "}
                          <DateTimePicker
                            value={toZonedDateTime(value.endTime)}
                            onChange={(t) => {
                              onChange({
                                ...value,
                                endTime: t.toDate(
                                  Intl.DateTimeFormat().resolvedOptions()
                                    .timeZone,
                                ),
                              });
                            }}
                            aria-label="End Time"
                          />
                          <span className="text-muted-foreground">
                            recurring
                          </span>
                          <div className="w-32">
                            <Select
                              value={value.recurrence}
                              onValueChange={(v) => {
                                onChange({
                                  ...value,
                                  recurrence: v,
                                });
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue>
                                  {_.capitalize(value.recurrence)}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="hourly">hourly</SelectItem>
                                  <SelectItem value="daily">daily</SelectItem>
                                  <SelectItem value="weekly">weekly</SelectItem>
                                  <SelectItem value="monthly">
                                    monthly
                                  </SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            className="h-6 w-6"
                          >
                            <IconX className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    }}
                  />
                );
              })}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-fit"
            onClick={() =>
              append({
                policyId: environmentPolicy.id,
                recurrence: "weekly",
                startTime: new Date(),
                endTime: new Date(),
              })
            }
          >
            Add Release Window
          </Button>
        </div>

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
          disabled={
            setPolicyWindows.isPending ||
            updatePolicy.isPending ||
            !form.formState.isDirty
          }
        >
          Save
        </Button>
      </form>
    </Form>
  );
};
