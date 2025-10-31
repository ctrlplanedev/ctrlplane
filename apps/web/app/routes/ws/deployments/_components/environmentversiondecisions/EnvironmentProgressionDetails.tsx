export function EnvironmentProgressionDetails({
  policyDetails,
}: {
  policyDetails: Array<{
    allowed: boolean;
    dependencyEnvironmentCount: number;
    dependencyEnvironmentDetails: Record<
      string,
      {
        minSuccessPercentageFailure?: {
          successPercentage: number;
          minimumSuccessPercentage: number;
        };
        soakTimeRemainingMinutes?: number;
        deploymentTooOld?: {
          latestSuccessTime: string;
          maximumAgeHours: number;
        };
      }
    >;
    message: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      {policyDetails.map((policy, policyIndex) => (
        <div key={policyIndex} className="space-y-2">
          {Object.entries(policy.dependencyEnvironmentDetails).map(
            ([envName, details]) => (
              <div key={envName} className="text-xs text-muted-foreground">
                <span className="font-medium">{envName}</span>
                <span className="mx-1">·</span>
                {details.minSuccessPercentageFailure ? (
                  <span>
                    Success rate{" "}
                    {details.minSuccessPercentageFailure.successPercentage.toFixed(
                      1,
                    )}
                    % is below minimum{" "}
                    {details.minSuccessPercentageFailure.minimumSuccessPercentage.toFixed(
                      1,
                    )}
                    %
                  </span>
                ) : details.soakTimeRemainingMinutes != null ? (
                  <span>
                    Soak time remaining:{" "}
                    {Math.ceil(details.soakTimeRemainingMinutes)} minutes
                  </span>
                ) : details.deploymentTooOld ? (
                  <span>
                    Deployment too old (max age:{" "}
                    {details.deploymentTooOld.maximumAgeHours} hours)
                  </span>
                ) : (
                  <span>{policy.message}</span>
                )}
              </div>
            ),
          )}
          {Object.keys(policy.dependencyEnvironmentDetails).length === 0 && (
            <div className="text-xs text-muted-foreground">
              {policy.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
