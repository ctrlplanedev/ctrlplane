export * from "./conditions/index.js";

export enum DeploymentVersionStatus {
  Ready = "ready",
  Building = "building",
  Failed = "failed",
  Rejected = "rejected",
}

export type DeploymentVersionStatusType = `${DeploymentVersionStatus}`;
