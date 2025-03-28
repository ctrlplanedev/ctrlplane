"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Textarea } from "@ctrlplane/ui/textarea";

import type { RuleTargetType } from "./mock-data";
import { SelectorsField } from "./SelectorsField";

interface CreateRuleDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const selectorSchema = z.object({
  type: z.enum(["metadata", "name", "tag", "environment", "deployment"]),
  key: z.string().optional(),
  value: z.string().optional(),
  operator: z.enum([
    "equals",
    "not-equals",
    "contains",
    "not-contains",
    "starts-with",
    "ends-with",
    "regex",
  ]),
  appliesTo: z.enum(["deployment", "environment"]).optional(),
});

const formSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
    description: z.string().optional(),
    priority: z.coerce.number().min(1).max(100),
    type: z.enum([
      "maintenance-window",
      "gradual-rollout",
      "time-window",
      "rollout-ordering",
      "rollout-pass-rate",
      "release-dependency",
    ]),
    targetType: z.enum(["deployment", "environment", "both"]),
    // Use conditionals for selectors based on targetType
    selectors: z.array(selectorSchema).optional(),
    conditions: z
      .object({
        deploymentSelectors: z.array(selectorSchema).optional(),
        environmentSelectors: z.array(selectorSchema).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // Validate that appropriate selectors are provided based on targetType
      if (data.targetType === "both") {
        return (
          data.conditions &&
          ((data.conditions.deploymentSelectors &&
            data.conditions.deploymentSelectors.length > 0) ||
            (data.conditions.environmentSelectors &&
              data.conditions.environmentSelectors.length > 0))
        );
      } else {
        return data.selectors && data.selectors.length > 0;
      }
    },
    {
      message: "At least one selector is required",
      path: ["selectors"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

export function CreateRuleDialog({
  workspaceId,
  open,
  onOpenChange,
}: CreateRuleDialogProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      priority: 50,
      type: "time-window",
      targetType: "deployment",
      selectors: [
        {
          type: "metadata",
          key: "",
          value: "",
          operator: "equals",
        },
      ],
      conditions: {
        deploymentSelectors: [],
        environmentSelectors: [],
      },
    },
  });

  const onSubmit = (values: FormValues) => {
    console.log(values);
    onOpenChange(false);
  };

  const targetType = form.watch("targetType");
  const ruleType = form.watch("type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Create New Rule</DialogTitle>
          <DialogDescription>
            Create a rule to control how and when deployments are released to
            environments
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Production Deployment Window"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        A descriptive name for this rule
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
                          placeholder="Describe the purpose of this rule"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional details about when and how this rule should be
                        applied
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority (1-100)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={100} {...field} />
                      </FormControl>
                      <FormDescription>
                        Lower numbers mean higher priority
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="targetType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Rule Target</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="deployment" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Deployment Rules (affect what can be deployed)
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="environment" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Environment Rules (affect when deployments can
                              happen)
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="both" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Both (combine deployment and environment
                              conditions)
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select rule type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {targetType === "environment" ? (
                            <>
                              <SelectItem value="time-window">
                                Deployment Time Window
                              </SelectItem>
                              <SelectItem value="maintenance-window">
                                Maintenance Window
                              </SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="gradual-rollout">
                                Gradual Rollout
                              </SelectItem>
                              <SelectItem value="rollout-ordering">
                                Rollout Ordering
                              </SelectItem>
                              <SelectItem value="rollout-pass-rate">
                                Success Rate Requirement
                              </SelectItem>
                              <SelectItem value="release-dependency">
                                Release Dependency
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The type of rule determines its behavior and required
                        configuration
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <SelectorsField
                  control={form.control}
                  name="selectors"
                  targetType={targetType as RuleTargetType}
                />

                <div className="rounded-md bg-muted/50 p-4">
                  <h3 className="mb-2 text-sm font-medium">
                    Rule Configuration Preview
                  </h3>
                  <div className="space-y-1 text-xs">
                    <div>
                      <strong>Name:</strong> {form.getValues("name")}
                    </div>
                    <div>
                      <strong>Type:</strong> {ruleType}
                    </div>
                    <div>
                      <strong>Target:</strong> {targetType}
                    </div>
                    <div>
                      <strong>Priority:</strong> {form.getValues("priority")}
                    </div>
                    <div>
                      <strong>Selectors:</strong>{" "}
                      {form.getValues("selectors").length} condition(s)
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    After creating this rule, you'll be able to configure
                    specific settings for the chosen rule type.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex items-center justify-between">
              <div>
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Step {step} of {totalSteps}
                </div>
                {step < totalSteps ? (
                  <Button
                    type="button"
                    onClick={() => {
                      // Validate the current step
                      if (step === 1) {
                        form.trigger(["name", "priority"]);
                        if (
                          form.getFieldState("name").invalid ||
                          form.getFieldState("priority").invalid
                        ) {
                          return;
                        }
                      } else if (step === 2) {
                        form.trigger(["targetType", "type"]);
                        if (
                          form.getFieldState("targetType").invalid ||
                          form.getFieldState("type").invalid
                        ) {
                          return;
                        }
                      }

                      setStep(step + 1);
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit">Create Rule</Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
