import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { IconLoader2 } from "@tabler/icons-react";

import { Checkbox } from "@ctrlplane/ui/checkbox";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import { RadioGroup, RadioGroupItem } from "@ctrlplane/ui/radio-group";

import { api } from "~/trpc/react";
import { useInvalidatePolicy } from "./useInvalidatePolicy";

type ApprovalAndGovernanceProps = {
  environmentPolicy: SCHEMA.EnvironmentPolicy;
  isLoading: boolean;
};

export const ApprovalAndGovernance: React.FC<ApprovalAndGovernanceProps> = ({
  environmentPolicy,
  isLoading,
}) => {
  const updatePolicy = api.environment.policy.update.useMutation();
  const invalidatePolicy = useInvalidatePolicy(environmentPolicy);
  const { id } = environmentPolicy;

  return (
    <div className="space-y-10 p-2">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          Approval & Governance
          {(isLoading || updatePolicy.isPending) && (
            <IconLoader2 className="h-4 w-4 animate-spin" />
          )}
        </h1>
        <span className="text-sm text-muted-foreground">
          This category defines policies that govern the oversight and approval
          process for deployments. These policies ensure that deployments meet
          specific criteria or gain necessary approvals before proceeding,
          contributing to compliance, quality assurance, and overall governance
          of the deployment process.
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Approval gates</h1>
          <span className="text-sm text-muted-foreground">
            If enabled, a release will require approval from an authorized user
            before it can be deployed to any environment with this policy.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="approvalRequirement"
            checked={environmentPolicy.approvalRequirement === "manual"}
            onCheckedChange={(value) => {
              updatePolicy
                .mutateAsync({
                  id,
                  data: { approvalRequirement: value ? "manual" : "automatic" },
                })
                .then(invalidatePolicy);
            }}
          />
          <label htmlFor="approvalRequirement" className="text-sm">
            Is approval required?
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-medium">Previous Deploy Status</h1>
          <span className="text-sm text-muted-foreground">
            Specify a minimum number of resources in dependent environments to
            successfully be deployed to before triggering a release. For
            example, specifying that all resources in QA must be deployed to
            before releasing to PROD.
          </span>
        </div>

        <div>
          <RadioGroup
            value={environmentPolicy.successType}
            onValueChange={(value: "all" | "some" | "optional") =>
              updatePolicy
                .mutateAsync({ id, data: { successType: value } })
                .then(invalidatePolicy)
            }
          >
            <div className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value="all" />
              <Label>
                All resources in dependent environments must complete
                successfully
              </Label>
            </div>

            <div className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value="some" />
              <Label className="flex items-center gap-1">
                A minimum of{" "}
                <Input
                  disabled={environmentPolicy.successType !== "some"}
                  type="number"
                  value={environmentPolicy.successMinimum}
                  onChange={(e) => {
                    const value = e.target.valueAsNumber;
                    const successMinimum = Number.isNaN(value) ? 0 : value;
                    updatePolicy
                      .mutateAsync({ id, data: { successMinimum } })
                      .then(invalidatePolicy);
                  }}
                  className="h-6 w-16 text-xs"
                />
                resources must be successfully deployed to
              </Label>
            </div>

            <div className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value="optional" />
              <Label>No validation required</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
};
