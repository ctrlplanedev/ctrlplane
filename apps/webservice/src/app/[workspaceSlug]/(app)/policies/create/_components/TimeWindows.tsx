"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useFieldArray, useForm } from "react-hook-form";
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
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
] as const;

const denyWindowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  timezone: z.string(),
  windows: z
    .array(
      z.object({
        days: z.array(z.enum(DAYS_OF_WEEK)).min(1, "Select at least one day"),
        startTime: z
          .string()
          .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
        endTime: z
          .string()
          .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format"),
      }),
    )
    .min(1, "At least one time window is required"),
});

type DenyWindowValues = z.infer<typeof denyWindowSchema>;

const defaultValues: DenyWindowValues = {
  name: "",
  enabled: true,
  timezone: "UTC",
  windows: [
    {
      days: [],
      startTime: "00:00",
      endTime: "00:00",
    },
  ],
};

export const TimeWindows: React.FC = () => {
  const form = useForm<DenyWindowValues>({
    resolver: zodResolver(denyWindowSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "windows",
  });

  function onSubmit(data: DenyWindowValues) {
    // This will be handled by the parent component
    console.log(data);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Time Window Rules</h2>
        <p className="text-sm text-muted-foreground">
          Configure when deployments should be blocked
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="max-w-lg space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Weekend Deployment Block"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A name to identify this deny window rule
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Block deployments during weekends and off-hours"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to explain when and why deployments are
                    blocked
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    All times will be interpreted in this timezone
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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
                      name={`windows.${index}.days`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Days of Week</FormLabel>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <Button
                                key={day}
                                type="button"
                                size="sm"
                                variant={
                                  field.value.includes(day)
                                    ? "default"
                                    : "outline"
                                }
                                className="capitalize"
                                onClick={() => {
                                  const newValue = field.value.includes(day)
                                    ? field.value.filter((d) => d !== day)
                                    : [...field.value, day];
                                  field.onChange(newValue);
                                }}
                              >
                                {day.slice(0, 3)}
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
                        name={`windows.${index}.startTime`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Start Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`windows.${index}.endTime`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>End Time</FormLabel>
                            <FormControl>
                              <Input type="time" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8"
                    onClick={() => remove(index)}
                  >
                    <IconTrash className="h-4 w-4" />
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
                    days: [],
                    startTime: "00:00",
                    endTime: "00:00",
                  })
                }
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add Time Window
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};
