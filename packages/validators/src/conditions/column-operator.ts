import { z } from "zod";

export enum ColumnOperator {
  Equals = "equals",
  StartsWith = "starts-with",
  EndsWith = "ends-with",
  Contains = "contains",
}

export const columnOperator = z.nativeEnum(ColumnOperator);

export type ColumnOperatorType = z.infer<typeof columnOperator>;
