"use client";

import { useEffect } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { startOfDay } from "date-fns";
import * as rrule from "rrule";

import { Button } from "@ctrlplane/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFieldArray,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { usePolicyFormContext } from "../_components/PolicyFormContext";

const getButtonVariant = (
  value: rrule.ByWeekday | rrule.ByWeekday[] | null,
  day: rrule.WeekdayStr,
) => {
  if (value == null) return "default";
  if (Array.isArray(value)) return value.includes(day) ? "default" : "outline";
  return value === day ? "default" : "outline";
};

const normalizeValue = (
  value: rrule.ByWeekday | rrule.ByWeekday[] | null,
): rrule.ByWeekday[] => {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

export const EditTimeWindow: React.FC<{
  policyId: string;
}> = ({ policyId }) => {
  const now = new Date();
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();

  const { data: policy } = api.policy.byId.useQuery({ policyId, timeZone });

  const { form } = usePolicyFormContext();

  useEffect(() => {
    if (policy == null) return;
    const currentValues = form.getValues();
    form.reset({ ...currentValues, denyWindows: policy.denyWindows });
  }, [policy, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "denyWindows",
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Time Window Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure when deployments should be blocked
        </p>
      </div>

      <div className="space-y-8">
        <div className="max-w-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-md font-medium">Deny Windows</h3>
              <p className="text-sm text-muted-foreground">
                Define the time periods when deployments should be blocked
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 space-y-4">
                  <FormField
                    control={form.control}
                    name={`denyWindows.${index}.rrule.byweekday`}
                    render={({ field: { value, onChange } }) => (
                      <FormItem>
                        <FormLabel>Days of Week</FormLabel>
                        <div className="flex flex-wrap gap-2">
                          {rrule.ALL_WEEKDAYS.map((day) => (
                            <Button
                              key={day}
                              type="button"
                              size="sm"
                              variant={getButtonVariant(value, day)}
                              className="capitalize"
                              onClick={() => {
                                const currentValue = normalizeValue(value);
                                const newValue = currentValue.includes(day)
                                  ? currentValue.filter((d) => d !== day)
                                  : [...currentValue, day];
                                onChange(newValue);
                              }}
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <FormField
                      control={form.control}
                      name={`denyWindows.${index}.rrule.dtstart`}
                      render={({ field: { value, onChange } }) => {
                        const date = value != null ? new Date(value) : now;
                        const hour = date
                          .getHours()
                          .toString()
                          .padStart(2, "0");
                        const minute = date
                          .getMinutes()
                          .toString()
                          .padStart(2, "0");

                        return (
                          <FormItem className="flex-1">
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                value={`${hour}:${minute}`}
                                onChange={(e) => {
                                  const [hour, minute] =
                                    e.target.value.split(":");
                                  if (hour == null || minute == null) return;
                                  const newDate = new Date(date);
                                  newDate.setHours(parseInt(hour));
                                  newDate.setMinutes(parseInt(minute));
                                  onChange(newDate);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    <FormField
                      control={form.control}
                      name={`denyWindows.${index}.dtend`}
                      render={({ field: { value, onChange } }) => {
                        const date = value != null ? new Date(value) : now;
                        const hour = date
                          .getHours()
                          .toString()
                          .padStart(2, "0");
                        const minute = date
                          .getMinutes()
                          .toString()
                          .padStart(2, "0");

                        return (
                          <FormItem className="flex-1">
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                value={`${hour}:${minute}`}
                                onChange={(e) => {
                                  const [hour, minute] =
                                    e.target.value.split(":");
                                  if (hour == null || minute == null) return;
                                  const newDate = new Date(date);
                                  newDate.setHours(parseInt(hour));
                                  newDate.setMinutes(parseInt(minute));
                                  onChange(newDate);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => remove(index)}
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                append({
                  rrule: {
                    byweekday: [] as rrule.ByWeekday[],
                    freq: rrule.Frequency.WEEKLY,
                    dtstart: startOfDay(now),
                  } as rrule.Options,
                  timeZone: timeZone,
                  dtend: startOfDay(now),
                })
              }
            >
              <IconPlus className="mr-2 h-4 w-4" />
              Add Time Window
            </Button>
          </div>
        </div>
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting || !form.formState.isDirty}
        className="w-fit"
      >
        Save
      </Button>
    </div>
  );
};
