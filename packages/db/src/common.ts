import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { eq, getTableColumns, ilike, sql } from "drizzle-orm";

import { ColumnOperator } from "@ctrlplane/validators/conditions";

import type { db } from "./client";

export const takeFirst = <T extends any[]>(values: T): T[number] => {
  if (values.length !== 1)
    throw new Error("Found non unique or inexistent value");
  return values[0]!;
};

export const takeFirstOrNull = <T extends any[]>(
  values: T,
): T[number] | null => {
  if (values.length !== 1) return null;
  return values[0]!;
};

export type Tx = Omit<typeof db, "$client">;

export const buildConflictUpdateColumns = <
  T extends PgTable,
  Q extends keyof T["_"]["columns"],
>(
  table: T,
  columns: Q[],
) => {
  const cls = getTableColumns(table);
  return columns.reduce(
    (acc, column) => {
      const colName = cls[column]?.name;
      acc[column] = sql.raw(`excluded.${colName}`);
      return acc;
    },
    {} as Record<Q, SQL>,
  );
};

export function enumToPgEnum<T extends Record<string, any>>(
  myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum).map((value: any) => `${value}`) as any;
}

export const getConditionOperator = <
  T extends PgTable,
  Q extends keyof T["_"]["columns"],
>(
  column: T["_"]["columns"][Q],
  operator: ColumnOperator,
): ((value: string) => SQL<unknown>) => {
  if (operator === ColumnOperator.Equals)
    return (value: string) => eq(column, value);
  if (operator === ColumnOperator.StartsWith)
    return (value: string) => ilike(column, `${value}%`);
  if (operator === ColumnOperator.EndsWith)
    return (value: string) => ilike(column, `%${value}`);
  return (value: string) => ilike(column, `%${value}%`);
};
