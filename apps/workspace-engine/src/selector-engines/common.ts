import { isAfter, isBefore, isEqual } from "date-fns";

import { ColumnOperator, DateOperator } from "@ctrlplane/validators/conditions";

export const StringComparisonFn: Record<
  ColumnOperator,
  (receivedValue: string, conditionValue: string) => boolean
> = {
  [ColumnOperator.Equals]: (receivedValue, conditionValue) =>
    receivedValue === conditionValue,
  [ColumnOperator.StartsWith]: (receivedValue, conditionValue) =>
    receivedValue.startsWith(conditionValue),
  [ColumnOperator.EndsWith]: (receivedValue, conditionValue) =>
    receivedValue.endsWith(conditionValue),
  [ColumnOperator.Contains]: (receivedValue, conditionValue) =>
    receivedValue.includes(conditionValue),
};

export const DateComparisonFn: Record<
  DateOperator,
  (receivedDate: Date, conditionDate: Date) => boolean
> = {
  [DateOperator.Before]: (receivedDate, conditionDate) =>
    isBefore(receivedDate, conditionDate),
  [DateOperator.After]: (receivedDate, conditionDate) =>
    isAfter(receivedDate, conditionDate),
  [DateOperator.BeforeOrOn]: (receivedDate, conditionDate) =>
    isBefore(receivedDate, conditionDate) ||
    isEqual(receivedDate, conditionDate),
  [DateOperator.AfterOrOn]: (receivedDate, conditionDate) =>
    isAfter(receivedDate, conditionDate) ||
    isEqual(receivedDate, conditionDate),
};
