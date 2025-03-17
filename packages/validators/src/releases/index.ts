export * from "./conditions/index.js";

export enum DeploymentVersionStatus {
  Ready = "ready",
  Building = "building",
  Failed = "failed",
}

export type DeploymentVersionStatusType = `${DeploymentVersionStatus}`;
