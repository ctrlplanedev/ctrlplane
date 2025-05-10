import type { DashboardWidget } from "../DashboardWidget";
import { WidgetDeploymentVersionDistribution } from "./WidgetDeploymentVersionDistribution";

export enum WidgetKind {
  DeploymentVersionDistribution = "deployment-version-distribution",
}

export const WidgetComponents: Record<WidgetKind, DashboardWidget> = {
  [WidgetKind.DeploymentVersionDistribution]:
    WidgetDeploymentVersionDistribution,
} as const;
