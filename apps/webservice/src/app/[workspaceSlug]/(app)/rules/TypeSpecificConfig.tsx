"use client";

import { useState } from "react";
import { Control, useWatch } from "react-hook-form";
import { PlusIcon, X } from "lucide-react";

import { Button } from "@ctrlplane/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ctrlplane/ui/select";
import { TimeField } from "@ctrlplane/ui/datetime-picker";

import { RuleTargetType, RuleType } from "./mock-data";

interface TypeSpecificConfigProps {
  control: Control<any>;
  name: string;
  ruleType: RuleType;
  targetType: RuleTargetType;
}

export function TypeSpecificConfig({ control, name, ruleType, targetType }: TypeSpecificConfigProps) {
  const configValue = useWatch({
    control,
    name,
  });

  // Return the appropriate config component based on the rule type
  switch (ruleType) {
    case 'time-window':
      return <TimeWindowConfig control={control} name={name} existingConfig={configValue} />;
    case 'maintenance-window':
      return <MaintenanceWindowConfig control={control} name={name} existingConfig={configValue} />;
    case 'gradual-rollout':
      return <GradualRolloutConfig control={control} name={name} existingConfig={configValue} />;
    case 'rollout-ordering':
      return <RolloutOrderingConfig control={control} name={name} existingConfig={configValue} />;
    case 'rollout-pass-rate':
      return <PassRateConfig control={control} name={name} existingConfig={configValue} />;
    case 'release-dependency':
      return <ReleaseDependencyConfig control={control} name={name} existingConfig={configValue} />;
    default:
      return (
        <div className="p-4 border border-dashed rounded-lg text-center">
          No configuration needed for this rule type.
        </div>
      );
  }
}

// Configuration component for Time Windows
function TimeWindowConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  const timezones = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney"
  ];

  const days = [
    { value: "MONDAY", label: "Monday" },
    { value: "TUESDAY", label: "Tuesday" },
    { value: "WEDNESDAY", label: "Wednesday" },
    { value: "THURSDAY", label: "Thursday" },
    { value: "FRIDAY", label: "Friday" },
    { value: "SATURDAY", label: "Saturday" },
    { value: "SUNDAY", label: "Sunday" },
  ];

  const [windows, setWindows] = useState(existingConfig?.windows || [
    { days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"], startTime: "09:00", endTime: "17:00" }
  ]);

  // Function to update the form value when windows change
  const updateFormValue = (newWindows: any[]) => {
    const updatedConfig = {
      ...existingConfig,
      windows: newWindows
    };
    control._formValues[name] = updatedConfig;
    control._updateFormState({
      ...control._formState,
      isDirty: true
    });
  };

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name={`${name}.timezone`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Timezone</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              defaultValue={existingConfig?.timezone || "UTC"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <FormLabel>Deployment Windows</FormLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newWindows = [...windows, { days: ["MONDAY"], startTime: "09:00", endTime: "17:00" }];
              setWindows(newWindows);
              updateFormValue(newWindows);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Window
          </Button>
        </div>
        <FormDescription>
          Define when deployments are allowed
        </FormDescription>

        {windows.map((window, windowIndex) => (
          <div key={windowIndex} className="p-4 border rounded-md relative space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6"
              onClick={() => {
                const newWindows = windows.filter((_, i) => i !== windowIndex);
                setWindows(newWindows);
                updateFormValue(newWindows);
              }}
            >
              <X className="h-4 w-4" />
            </Button>

            <FormItem>
              <FormLabel>Days</FormLabel>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={window.days.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newWindows = [...windows];
                      const newDays = window.days.includes(day.value)
                        ? window.days.filter(d => d !== day.value)
                        : [...window.days, day.value];
                      
                      newWindows[windowIndex] = {
                        ...window,
                        days: newDays,
                      };
                      setWindows(newWindows);
                      updateFormValue(newWindows);
                    }}
                  >
                    {day.label.substring(0, 3)}
                  </Button>
                ))}
              </div>
            </FormItem>

            <div className="grid grid-cols-2 gap-4">
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <Input
                  type="time"
                  value={window.startTime}
                  onChange={(e) => {
                    const newWindows = [...windows];
                    newWindows[windowIndex] = {
                      ...window,
                      startTime: e.target.value,
                    };
                    setWindows(newWindows);
                    updateFormValue(newWindows);
                  }}
                />
              </FormItem>

              <FormItem>
                <FormLabel>End Time</FormLabel>
                <Input
                  type="time"
                  value={window.endTime}
                  onChange={(e) => {
                    const newWindows = [...windows];
                    newWindows[windowIndex] = {
                      ...window,
                      endTime: e.target.value,
                    };
                    setWindows(newWindows);
                    updateFormValue(newWindows);
                  }}
                />
              </FormItem>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Configuration component for Maintenance Windows
function MaintenanceWindowConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  const recurrenceOptions = [
    { value: "WEEKLY", label: "Weekly" },
    { value: "MONTHLY", label: "Monthly" },
    { value: "QUARTERLY", label: "Quarterly" },
  ];

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name={`${name}.recurrence`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Recurrence</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              defaultValue={existingConfig?.recurrence || "MONTHLY"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence pattern" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {recurrenceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {existingConfig?.recurrence === "MONTHLY" && (
        <FormField
          control={control}
          name={`${name}.dayOfMonth`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Day of Month</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={31} {...field} value={field.value || 1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${name}.startTime`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value || "01:00"} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${name}.duration`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Duration (minutes)</FormLabel>
              <FormControl>
                <Input type="number" min={30} {...field} value={field.value || 120} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={`${name}.timezone`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Timezone</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              defaultValue={existingConfig?.timezone || "UTC"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">America/New_York</SelectItem>
                <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                <SelectItem value="Europe/London">Europe/London</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

// Configuration component for Gradual Rollout
function GradualRolloutConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  const [stages, setStages] = useState(existingConfig?.stages || [
    { percentage: 10, durationMinutes: 30 },
    { percentage: 50, durationMinutes: 60 },
    { percentage: 100, durationMinutes: 0 }
  ]);

  // Function to update the form value when stages change
  const updateFormValue = (newStages: any[]) => {
    const updatedConfig = {
      ...existingConfig,
      stages: newStages
    };
    control._formValues[name] = updatedConfig;
    control._updateFormState({
      ...control._formState,
      isDirty: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <FormLabel>Rollout Stages</FormLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const lastStage = stages[stages.length - 1];
              const newPercentage = Math.min(100, lastStage ? lastStage.percentage + 25 : 25);
              
              const newStages = [...stages, { percentage: newPercentage, durationMinutes: 30 }];
              setStages(newStages);
              updateFormValue(newStages);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Stage
          </Button>
        </div>
        <FormDescription>
          Define how the rollout progresses in stages
        </FormDescription>

        {stages.map((stage, stageIndex) => (
          <div key={stageIndex} className="p-4 border rounded-md relative grid grid-cols-2 gap-4">
            {stages.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => {
                  const newStages = stages.filter((_, i) => i !== stageIndex);
                  setStages(newStages);
                  updateFormValue(newStages);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <FormItem>
              <FormLabel>Percentage</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={stage.percentage}
                  onChange={(e) => {
                    const newStages = [...stages];
                    newStages[stageIndex] = {
                      ...stage,
                      percentage: parseInt(e.target.value, 10) || 0,
                    };
                    setStages(newStages);
                    updateFormValue(newStages);
                  }}
                />
              </FormControl>
              <FormDescription>% of resources to deploy</FormDescription>
            </FormItem>

            <FormItem>
              <FormLabel>Duration (minutes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={stage.durationMinutes}
                  onChange={(e) => {
                    const newStages = [...stages];
                    newStages[stageIndex] = {
                      ...stage,
                      durationMinutes: parseInt(e.target.value, 10) || 0,
                    };
                    setStages(newStages);
                    updateFormValue(newStages);
                  }}
                />
              </FormControl>
              <FormDescription>0 for final stage</FormDescription>
            </FormItem>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <FormLabel>Rollback Thresholds</FormLabel>
        <FormDescription className="mb-4">
          Define conditions that trigger automatic rollback
        </FormDescription>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name={`${name}.rollbackThreshold.errorRate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Error Rate (%)</FormLabel>
                <FormControl>
                  <Input type="number" min={0.1} max={100} step={0.1} {...field} value={field.value || 5} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.rollbackThreshold.responseTime`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Response Time (ms)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} value={field.value || 500} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// Configuration component for Rollout Ordering
function RolloutOrderingConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  const [order, setOrder] = useState(existingConfig?.order || [
    { name: "", delayAfterMinutes: 5 }
  ]);

  // Function to update the form value when order changes
  const updateFormValue = (newOrder: any[]) => {
    const updatedConfig = {
      ...existingConfig,
      order: newOrder
    };
    control._formValues[name] = updatedConfig;
    control._updateFormState({
      ...control._formState,
      isDirty: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <FormLabel>Deployment Order</FormLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newOrder = [...order, { name: "", delayAfterMinutes: 5 }];
              setOrder(newOrder);
              updateFormValue(newOrder);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </div>
        <FormDescription>
          Define the order of deployments
        </FormDescription>

        {order.map((step, stepIndex) => (
          <div key={stepIndex} className="p-4 border rounded-md relative grid grid-cols-2 gap-4">
            {order.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => {
                  const newOrder = order.filter((_, i) => i !== stepIndex);
                  setOrder(newOrder);
                  updateFormValue(newOrder);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <FormItem>
              <FormLabel>Name or Pattern</FormLabel>
              <FormControl>
                <Input
                  value={step.name}
                  onChange={(e) => {
                    const newOrder = [...order];
                    newOrder[stepIndex] = {
                      ...step,
                      name: e.target.value,
                    };
                    setOrder(newOrder);
                    updateFormValue(newOrder);
                  }}
                  placeholder="service-name or *-api"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel>Delay After (minutes)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={step.delayAfterMinutes}
                  onChange={(e) => {
                    const newOrder = [...order];
                    newOrder[stepIndex] = {
                      ...step,
                      delayAfterMinutes: parseInt(e.target.value, 10) || 0,
                    };
                    setOrder(newOrder);
                    updateFormValue(newOrder);
                  }}
                />
              </FormControl>
            </FormItem>
          </div>
        ))}
      </div>

      <FormField
        control={control}
        name={`${name}.failFast`}
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Fail Fast</FormLabel>
              <FormDescription>
                Cancel all subsequent deployments if one fails
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                defaultChecked={existingConfig?.failFast || false}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
}

// Configuration component for Pass Rate
function PassRateConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name={`${name}.metricName`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Metric Name</FormLabel>
            <Select 
              onValueChange={field.onChange} 
              defaultValue={existingConfig?.metricName || "http_success_percentage"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="http_success_percentage">HTTP Success Rate (%)</SelectItem>
                <SelectItem value="error_rate">Error Rate (%)</SelectItem>
                <SelectItem value="latency_p95">P95 Latency (ms)</SelectItem>
                <SelectItem value="cpu_utilization">CPU Utilization (%)</SelectItem>
                <SelectItem value="memory_utilization">Memory Utilization (%)</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`${name}.threshold`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Threshold</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                {...field} 
                value={field.value || 99} 
              />
            </FormControl>
            <FormDescription>
              Required value to pass (e.g., 99% success rate)
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${name}.observationWindowMinutes`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observation Window (minutes)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  {...field} 
                  value={field.value || 15} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${name}.minimumSampleSize`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Sample Size</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  {...field} 
                  value={field.value || 100} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

// Configuration component for Release Dependencies
function ReleaseDependencyConfig({ control, name, existingConfig }: { control: Control<any>; name: string; existingConfig: any }) {
  const [dependencies, setDependencies] = useState(existingConfig?.dependencies || [
    { name: "", requiredVersion: "" }
  ]);

  // Function to update the form value when dependencies change
  const updateFormValue = (newDependencies: any[]) => {
    const updatedConfig = {
      ...existingConfig,
      dependencies: newDependencies
    };
    control._formValues[name] = updatedConfig;
    control._updateFormState({
      ...control._formState,
      isDirty: true
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <FormLabel>Dependencies</FormLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const newDependencies = [...dependencies, { name: "", requiredVersion: "" }];
              setDependencies(newDependencies);
              updateFormValue(newDependencies);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Dependency
          </Button>
        </div>
        <FormDescription>
          Define required dependencies that must be deployed first
        </FormDescription>

        {dependencies.map((dep, depIndex) => (
          <div key={depIndex} className="p-4 border rounded-md relative grid grid-cols-2 gap-4">
            {dependencies.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6"
                onClick={() => {
                  const newDependencies = dependencies.filter((_, i) => i !== depIndex);
                  setDependencies(newDependencies);
                  updateFormValue(newDependencies);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            <FormItem>
              <FormLabel>Dependency Name</FormLabel>
              <FormControl>
                <Input
                  value={dep.name}
                  onChange={(e) => {
                    const newDependencies = [...dependencies];
                    newDependencies[depIndex] = {
                      ...dep,
                      name: e.target.value,
                    };
                    setDependencies(newDependencies);
                    updateFormValue(newDependencies);
                  }}
                  placeholder="service-name"
                />
              </FormControl>
            </FormItem>

            <FormItem>
              <FormLabel>Required Version</FormLabel>
              <FormControl>
                <Input
                  value={dep.requiredVersion}
                  onChange={(e) => {
                    const newDependencies = [...dependencies];
                    newDependencies[depIndex] = {
                      ...dep,
                      requiredVersion: e.target.value,
                    };
                    setDependencies(newDependencies);
                    updateFormValue(newDependencies);
                  }}
                  placeholder=">=1.0.0 or 2.x"
                />
              </FormControl>
            </FormItem>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${name}.waitForStability`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Wait for Stability</FormLabel>
                <FormDescription>
                  Wait for dependencies to stabilize
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  defaultChecked={existingConfig?.waitForStability || true}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${name}.timeoutMinutes`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timeout (minutes)</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  min={1} 
                  {...field} 
                  value={field.value || 60} 
                />
              </FormControl>
              <FormDescription>
                Maximum wait time
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}