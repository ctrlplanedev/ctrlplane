"use client";

import type {
  EnvironmentPolicy,
  EnvironmentPolicyReleaseWindow,
} from "@ctrlplane/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { ZonedDateTime } from "@internationalized/date";
import {
  IconBolt,
  IconFilter,
  IconInfoCircle,
  IconRegex,
  IconUser,
  IconVersions,
  IconX,
} from "@tabler/icons-react";
import _ from "lodash";
import ms from "ms";
import prettyMilliseconds from "pretty-ms";
import { useFieldArray, useForm } from "react-hook-form";
import { validRange } from "semver";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import { DateTimePicker } from "@ctrlplane/ui/date-time-picker/date-time-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Separator } from "@ctrlplane/ui/separator";
import { Textarea } from "@ctrlplane/ui/textarea";

import { api } from "~/trpc/react";

const isValidRegex = (str: string) => {
  try {
    new RegExp(str);
    return true;
  } catch {
    return false;
  }
};

const isValidDuration = (str: string) => {
  try {
    ms(str);
    return true;
  } catch {
    return false;
  }
};

const policyForm = z
  .object({
    name: z.string(),
    description: z.string(),
    approvalRequirement: z.enum(["automatic", "manual"]),
    successType: z.enum(["all", "some", "optional"]),
    successMinimum: z.number().min(0, "Must be a positive number"),
    duration: z.string().refine(isValidDuration, {
      message: "Invalid duration pattern",
    }),
    releaseSequencing: z.enum(["wait", "cancel"]),
    releaseWindows: z
      .array(
        z.object({
          policyId: z.string().uuid(),
          recurrence: z.enum(["hourly", "daily", "weekly", "monthly"]),
          startTime: z.date(),
          endTime: z.date(),
        }),
      )
      .nullable()
      .default(null),
    concurrencyType: z.enum(["all", "some"]),
    concurrencyLimit: z.number().min(1, "Must be a positive number"),
  })
  .and(
    z
      .object({
        evaluateWith: z.literal("regex"),
        evaluate: z.string().refine(isValidRegex, {
          message: "Invalid regex pattern",
        }),
      })
      .or(
        z.object({
          evaluateWith: z.literal("none"),
          evaluate: z
            .string()
            .max(0, `'none' cannot have a string to be evaluated.`),
        }),
      )
      .or(
        z.object({
          evaluateWith: z.literal("semver"),
          evaluate: z
            .string()
            .refine((s) => validRange(s) !== null, "Invalid semver range"),
        }),
      ),
  );

type PhaseFormValues = z.infer<typeof policyForm>;

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

export const SidebarPhasePanel: React.FC<{
  policy: EnvironmentPolicy & {
    releaseWindows: Array<EnvironmentPolicyReleaseWindow> | null;
  };
  systemId: string;
}> = ({ policy, systemId }) => {
  const form = useForm<PhaseFormValues>({
    resolver: zodResolver(policyForm),
    defaultValues: {
      ...policy,
      description: policy.description ?? "",
      duration: prettyMilliseconds(policy.duration),
    },
    mode: "onChange",
  });

  const { mutateAsync, error, isError } =
    api.environment.policy.update.useMutation();
  const setPolicyWindows = api.environment.policy.setWindows.useMutation();
  const utils = api.useUtils();

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "releaseWindows",
  });

  const { evaluateWith, successMinimum, concurrencyLimit } = form.watch();

  const onSubmit = form.handleSubmit(async (values) => {
    const isReleaseWindowsChanged = !_.isEqual(
      values.releaseWindows,
      policy.releaseWindows,
    );
    const isSettingNullToEmptyArray =
      values.releaseWindows?.length === 0 && policy.releaseWindows == null;
    if (
      isReleaseWindowsChanged &&
      values.releaseWindows != null &&
      !isSettingNullToEmptyArray
    )
      await setPolicyWindows.mutateAsync({
        policyId: policy.id,
        releaseWindows: values.releaseWindows,
      });

    await mutateAsync({
      id: policy.id,
      data: {
        ...values,
        duration: ms(values.duration),
      },
    });

    utils.environment.policy.bySystemId.invalidate(systemId);
    form.reset(values);
  });

  return (
    <Form {...form}>
      <h2 className="flex items-center gap-4 p-6 text-2xl font-semibold">
        <div className="flex-shrink-0 rounded bg-neutral-800 p-1 text-neutral-400">
          <IconFilter className="h-4 w-4" />
        </div>
        <span className="flex-grow">Policy</span>
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 text-neutral-500 hover:text-white"
        >
          <IconInfoCircle className="h-4 w-4" />
        </Button>
      </h2>
      <Separator />
      <form onSubmit={onSubmit} className="m-6 space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Add a name..." {...field} />
              </FormControl>
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
                <Textarea placeholder="Add a description..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="approvalRequirement"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Approval</FormLabel>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="automatic" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      <IconBolt className="h-4 w-4 text-neutral-400" />
                      Automatic approval
                    </FormLabel>
                  </FormItem>

                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="manual" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      <IconUser className="text-neutral-400" /> Manual approval
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="successType"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Previous Deploy Status</FormLabel>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="all" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      All environments must complete sucessfully
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="some" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      A minimum of{" "}
                      <Input
                        disabled={value !== "some"}
                        type="number"
                        value={successMinimum}
                        onChange={(e) =>
                          form.setValue(
                            "successMinimum",
                            e.target.valueAsNumber,
                          )
                        }
                        className="border-b-1 h-6 w-16 text-xs"
                      />
                      must complete
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="optional" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      No validation required
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="releaseSequencing"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Release Sequencing</FormLabel>
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
        <FormField
          control={form.control}
          name="concurrencyType"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel>Concurrency</FormLabel>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3">
                    <FormControl>
                      <RadioGroupItem value="all" />
                    </FormControl>
                    <FormLabel className="flex items-center gap-2 font-normal">
                      All jobs can run concurrently
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="some" className="min-w-4" />
                    </FormControl>
                    <FormLabel className="flex flex-wrap items-center gap-2 font-normal">
                      A maximum of
                      <Input
                        disabled={value !== "some"}
                        type="number"
                        value={concurrencyLimit}
                        onChange={(e) =>
                          form.setValue(
                            "concurrencyLimit",
                            e.target.valueAsNumber,
                          )
                        }
                        className="border-b-1 h-6 w-16 text-xs"
                      />
                      jobs can run concurrently
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="duration"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <FormLabel className="flex items-center">
                Gradual Rollout
              </FormLabel>
              <FormLabel className="flex items-center gap-2 font-normal">
                Spread deployments out over{" "}
                <FormControl>
                  <Input
                    type="string"
                    value={value}
                    placeholder="1d"
                    onChange={onChange}
                    className="border-b-1 h-6 w-16 text-xs"
                  />
                </FormControl>
              </FormLabel>
            </FormItem>
          )}
        />
        <div className="flex">
          <FormField
            control={form.control}
            name="evaluateWith"
            render={({ field: { value, onChange } }) => (
              <FormItem>
                <FormLabel>Release Validation</FormLabel>
                <FormControl>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="w-[180px] rounded-r-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="regex">
                          <IconRegex className="mb-1 mr-2 inline text-neutral-500" />
                          Regex
                        </SelectItem>
                        <SelectItem value="semver">
                          <IconVersions className="mb-1 mr-2 inline text-neutral-500" />
                          Semver
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="evaluate"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormLabel className="text-transparent">
                  Validation String
                </FormLabel>
                <FormControl>
                  <Input
                    className="rounded-l-none"
                    {...field}
                    value={evaluateWith === "none" ? "" : field.value}
                    disabled={evaluateWith === "none"}
                    placeholder={
                      evaluateWith === "none"
                        ? "No string required."
                        : evaluateWith === "semver"
                          ? "1.0.0"
                          : "^[a-zA-Z0-9]+"
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Label>Release Windows</Label>

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
                      className="flex items-center justify-between rounded-md border px-4 py-3 text-sm"
                    >
                      <div className="flex flex-grow flex-col gap-3">
                        <div className="flex items-center gap-1">
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
                          <span>to</span>{" "}
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
                        </div>

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
                            <SelectTrigger>
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
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="h-8 w-8 p-0 text-neutral-500 hover:text-white"
                      >
                        <IconX />
                      </Button>
                    </div>
                  );
                }}
              />
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-36"
            onClick={() =>
              append({
                policyId: policy.id,
                recurrence: "weekly",
                startTime: new Date(),
                endTime: new Date(),
              })
            }
          >
            Add Release Window
          </Button>
        </div>

        <Button
          type="submit"
          disabled={Object.keys(form.formState.dirtyFields).length === 0}
        >
          Save
        </Button>
        {isError && <div className="text-red-500">{error.message}</div>}
      </form>
    </Form>
  );
};
