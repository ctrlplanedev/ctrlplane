import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";

export type Policy = {
  id: string;
  name: string;
  deploymentVersionSelector: DeploymentVersionCondition;
  priority: number;
};
