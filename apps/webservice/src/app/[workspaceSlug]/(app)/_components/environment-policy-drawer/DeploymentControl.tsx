import React from "react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@ctrlplane/ui/form";
import { Input } from "@ctrlplane/ui/input";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";

import type { PolicyFormSchema } from "./PolicyFormSchema";

export const DeploymentControl: React.FC<{
  form: PolicyFormSchema;
}> = ({ form }) => {
  const { concurrencyLimit } = form.watch();

  return (
    <div className="space-y-10 p-2">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium">Deployment Control</h1>
        <span className="text-sm text-muted-foreground">
          Deployment control policies focus on regulating how deployments are
          executed within an environment. These policies manage concurrency,
          filtering of releases, and other operational constraints, ensuring
          efficient and orderly deployment processes without overwhelming
          resources or violating environment-specific rules.
        </span>
      </div>
      <FormField
        control={form.control}
        name="concurrencyType"
        render={({ field: { value, onChange } }) => (
          <FormItem>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <FormLabel>Concurrency</FormLabel>
                <FormDescription>
                  The number of jobs that can run concurrently in an
                  environment.
                </FormDescription>
              </div>
              <FormControl>
                <RadioGroup value={value} onValueChange={onChange}>
                  <FormItem className="flex items-center space-x-3 space-y-0">
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
            </div>
          </FormItem>
        )}
      />
    </div>
  );
};
