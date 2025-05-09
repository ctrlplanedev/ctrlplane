import type * as schema from "@ctrlplane/db/schema";
import type React from "react";

import { WidgetDeploymentVersionDistribution } from "./WidgetDeploymentVersionDistribution";

type WidgetComponent = React.FC<{ widget: schema.DashboardWidget }>;

export enum WidgetKind {
  DeploymentVersionDistribution = "deployment-version-distribution",
}

export const WidgetComponents: Record<WidgetKind, WidgetComponent> = {
  [WidgetKind.DeploymentVersionDistribution]:
    WidgetDeploymentVersionDistribution,
} as const;
