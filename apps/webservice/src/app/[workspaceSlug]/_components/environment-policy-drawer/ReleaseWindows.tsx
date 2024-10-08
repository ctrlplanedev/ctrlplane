import type * as schema from "@ctrlplane/db/schema";
import React from "react";
import { ZonedDateTime } from "@internationalized/date";
import { IconX } from "@tabler/icons-react";
import _ from "lodash";
import ms from "ms";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DateTimePicker } from "@ctrlplane/ui/date-time-picker/date-time-picker";
import { Form, FormField, useFieldArray, useForm } from "@ctrlplane/ui/form";
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

const releaseWindowsForm = z.object({
  releaseWindows: z.array(
    z.object({
      policyId: z.string().uuid(),
      recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
      startTime: z.date(),
      endTime: z.date(),
    }),
  ),
});

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

export const ReleaseWindows: React.FC<{
  environmentPolicy: schema.EnvironmentPolicy & {
    releaseWindows: schema.EnvironmentPolicyReleaseWindow[];
  };
}> = ({ environmentPolicy }) => {
  const form = useForm({
    schema: releaseWindowsForm,
    defaultValues: {
      releaseWindows: environmentPolicy.releaseWindows,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "releaseWindows",
  });

  const setPolicyWindows = api.environment.policy.setWindows.useMutation();
  const utils = api.useUtils();

  const onSubmit = form.handleSubmit((data) =>
    setPolicyWindows
      .mutateAsync({
        policyId: environmentPolicy.id,
        releaseWindows: data.releaseWindows,
      })
      .then(() => form.reset(data))
      .then(() =>
        utils.environment.policy.byId.invalidate(environmentPolicy.id),
      ),
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label>Release Windows</Label>
          <span className="text-xs text-muted-foreground">
            Release windows allow you to control when deployments can be
            released into an environment.
          </span>
        </div>

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
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
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
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          ),
                        });
                      }}
                      aria-label="End Time"
                    />
                    <span className="text-muted-foreground">recurring</span>
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
                            <SelectItem value="monthly">monthly</SelectItem>
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

        <div className="flex gap-2">
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
          <Button
            type="submit"
            disabled={setPolicyWindows.isPending || !form.formState.isDirty}
          >
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};
