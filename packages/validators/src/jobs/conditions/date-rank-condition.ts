import { z } from "zod";

const dateRankColumn = z.enum(["resource", "environment"]);

export const dateRankCondition = z.object({
  type: z.literal("date-rank"),
  operator: z.enum(["latest", "earliest"]),
  value: dateRankColumn,
});

export type DateRankCondition = z.infer<typeof dateRankCondition>;

export enum DateRankOperator {
  Earliest = "earliest",
  Latest = "latest",
}

export type DateRankOperatorType = `${DateRankOperator}`;

export enum DateRankValue {
  Resource = "resource",
  Environment = "environment",
}

export type DateRankValueType = `${DateRankValue}`;
