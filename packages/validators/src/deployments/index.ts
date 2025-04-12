import { z } from "zod";

export enum StatsColumn {
  LastRunAt = "last-run-at",
  TotalJobs = "total-jobs",
  P50 = "p50",
  P90 = "p90",
  Name = "name",
  SuccessRate = "success-rate",
  AssociatedResources = "associated-resources",
}

export const statsColumn = z.nativeEnum(StatsColumn);

export enum StatsOrder {
  Asc = "asc",
  Desc = "desc",
}

export const statsOrder = z.nativeEnum(StatsOrder);

export * from "./conditions/index.js";
