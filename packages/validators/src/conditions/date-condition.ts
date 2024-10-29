import { z } from "zod";

const operator = z.union([
  z.literal("before"),
  z.literal("after"),
  z.literal("before-or-on"),
  z.literal("after-or-on"),
]);

const isValidDate = (v: string) => !Number.isNaN(new Date(v).getTime());
const value = z.string().refine(isValidDate, { message: "Invalid date" });

const createdAt = z.literal("created-at");
const updatedAt = z.literal("updated-at");

export enum DateOperator {
  Before = "before",
  After = "after",
  BeforeOrOn = "before-or-on",
  AfterOrOn = "after-or-on",
}

export type DateOperatorType =
  | DateOperator.Before
  | DateOperator.After
  | DateOperator.BeforeOrOn
  | DateOperator.AfterOrOn;

export const createdAtCondition = z.object({
  type: createdAt,
  operator,
  value,
});

export type CreatedAtCondition = z.infer<typeof createdAtCondition>;

export const updatedAtCondition = z.object({
  type: updatedAt,
  operator,
  value,
});

export type UpdatedAtCondition = z.infer<typeof updatedAtCondition>;
