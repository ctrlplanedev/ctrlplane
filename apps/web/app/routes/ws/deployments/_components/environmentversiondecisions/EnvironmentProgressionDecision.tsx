import { ChevronRight } from "lucide-react";

import type { DeploymentVersion, Environment } from "./types";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { CollapsibleDecision } from "./CollapsibleDecsion";
import { EnvironmentProgressionDetails } from "./EnvironmentProgressionDetails";
import { EnvironmentProgressionStatus } from "./EnvironmentProgressionStatus";
import { usePolicyResults } from "./usePolicyResults";

export function EnvironmentProgressionDecision({
  version,
  environment,
}: {
  version: DeploymentVersion;
  environment: Environment;
}) {
  const { policyResults } = usePolicyResults(environment.id, version.id);
  const environmentProgressionResult = policyResults?.environmentProgression;
  if (environmentProgressionResult == null) return null;

  const isAllowed = environmentProgressionResult.every(
    (policyResult) => policyResult.details.allowed,
  );

  const isFailure = environmentProgressionResult.some((policyResult) =>
    Object.values(policyResult.details.dependencyEnvironmentDetails).some(
      (details) =>
        details.deploymentTooOld != null ||
        details.minSuccessPercentageFailure != null,
    ),
  );

  const policyDetails = environmentProgressionResult.map(
    ({ details }) => details,
  );

  return (
    <CollapsibleDecision
      Heading={({ isExpanded, onClick }) => (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            className="h-5 w-5"
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform duration-200",
                isExpanded && "rotate-90",
              )}
            />
          </Button>
          <EnvironmentProgressionStatus
            allowed={isAllowed}
            failure={isFailure}
          />
        </div>
      )}
      Content={
        <div className="pl-6">
          <EnvironmentProgressionDetails policyDetails={policyDetails} />
        </div>
      }
    />
  );
}
