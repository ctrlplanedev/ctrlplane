import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { useDebounce } from "react-use";

import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import { useInvalidatePolicy } from "./useInvalidatePolicy";

export const DeploymentControl: React.FC<{
  environmentPolicy: SCHEMA.EnvironmentPolicy;
}> = ({ environmentPolicy }) => {
  const [concurrencyLimit, setConcurrencyLimit] = useState(
    environmentPolicy.concurrencyLimit?.toString() ?? "",
  );

  const updatePolicy = api.environment.policy.update.useMutation();
  const invalidatePolicy = useInvalidatePolicy(environmentPolicy);
  const { id } = environmentPolicy;
  useDebounce(
    () => {
      if (concurrencyLimit === "") return;
      const limit = Number(concurrencyLimit);
      if (Number.isNaN(limit)) return;
      updatePolicy
        .mutateAsync({ id, data: { concurrencyLimit: limit } })
        .then(invalidatePolicy)
        .catch((e) => toast.error(e.message));
    },
    300,
    [concurrencyLimit],
  );

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
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <Label>Concurrency</Label>
          <div className="text-sm text-muted-foreground">
            The number of jobs that can run concurrently in an environment.
          </div>
        </div>

        <RadioGroup
          value={environmentPolicy.concurrencyLimit != null ? "some" : "all"}
          onValueChange={(value) => {
            const concurrencyLimit = value === "some" ? 1 : null;
            setConcurrencyLimit(String(concurrencyLimit ?? ""));
            updatePolicy
              .mutateAsync({ id, data: { concurrencyLimit } })
              .then(invalidatePolicy);
          }}
        >
          <div className="flex items-center space-x-3 space-y-0">
            <RadioGroupItem value="all" />
            <Label className="flex items-center gap-2 font-normal">
              All jobs can run concurrently
            </Label>
          </div>
          <div className="flex items-center space-x-3 space-y-0">
            <RadioGroupItem value="some" className="min-w-4" />
            <Label className="flex flex-wrap items-center gap-2 font-normal">
              A maximum of
              <Input
                disabled={environmentPolicy.concurrencyLimit == null}
                type="number"
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(e.target.value)}
                className="border-b-1 h-6 w-16 text-xs"
              />
              jobs can run concurrently
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};
