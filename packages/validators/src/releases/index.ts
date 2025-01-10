export * from "./conditions/index.js";

export enum ReleaseStatus {
  Ready = "ready",
  Building = "building",
  Failed = "failed",
}

export type ReleaseStatusType = `${ReleaseStatus}`;
