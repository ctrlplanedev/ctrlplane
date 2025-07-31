import { RolloutCurveChart } from "./rollout-charts/RolloutCurve";
import { RolloutDistributionCard } from "./rollout-charts/RolloutDistributionCard";
import { RolloutPercentCard } from "./rollout-charts/RolloutPercentCard";

export const ChartsSection: React.FC<{
  deploymentId: string;
  environmentId: string;
  versionId: string;
}> = (props) => (
  <div className="space-y-4 p-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-1">
        <RolloutPercentCard {...props} />
      </div>
      <div className="col-span-1">
        <RolloutDistributionCard {...props} />
      </div>
    </div>
    <RolloutCurveChart {...props} />
  </div>
);
