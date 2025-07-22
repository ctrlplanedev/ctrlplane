import type { Widget } from "../DashboardWidget";
import { WidgetDeploymentVersionDistribution } from "./deployment-version-distribution/WidgetDeploymentVersionDistribution";
import { WidgetReleaseTargetModule } from "./release-target-module/WidgetReleaseTargetModule";
import { WidgetSystemResourceDeployments } from "./system-resource-deployer/WidgetSystemResourceDeployer";
import { WidgetHeading } from "./WidgetHeading";

export enum WidgetKind {
  DeploymentVersionDistribution = "deployment-version-distribution",
  ReleaseTargetModule = "release-target-module",
  Heading = "heading",
  SystemResourceDeployments = "system-resource-deployments",
}

export const WidgetComponents: Record<WidgetKind, Widget<any>> = {
  [WidgetKind.DeploymentVersionDistribution]:
    WidgetDeploymentVersionDistribution,
  [WidgetKind.ReleaseTargetModule]: WidgetReleaseTargetModule,
  [WidgetKind.SystemResourceDeployments]: WidgetSystemResourceDeployments,
  [WidgetKind.Heading]: WidgetHeading,
} as const;
