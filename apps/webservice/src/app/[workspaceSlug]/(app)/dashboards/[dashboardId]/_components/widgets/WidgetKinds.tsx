import type { DashboardWidget } from "../DashboardWidget";
import { WidgetDeploymentVersionDistribution } from "./deployment-version-distribution/WidgetDeploymentVersionDistribution";
import { WidgetReleaseTargetModule } from "./release-target-module/WidgetReleaseTargetModule";

export enum WidgetKind {
  DeploymentVersionDistribution = "deployment-version-distribution",
  ReleaseTargetModule = "release-target-module",
}

export const WidgetComponents: Record<WidgetKind, DashboardWidget> = {
  [WidgetKind.DeploymentVersionDistribution]:
    WidgetDeploymentVersionDistribution,
  [WidgetKind.ReleaseTargetModule]: WidgetReleaseTargetModule,
} as const;
