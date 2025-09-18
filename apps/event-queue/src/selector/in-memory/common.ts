import { ColumnOperator, DateOperator } from "@ctrlplane/validators/conditions";

export const StringConditionOperatorFn: Record<
  ColumnOperator,
  (entityValue: string, selectorValue: string) => boolean
> = {
  [ColumnOperator.Equals]: (entityValue, selectorValue) =>
    entityValue === selectorValue,
  [ColumnOperator.StartsWith]: (entityValue, selectorValue) =>
    entityValue.startsWith(selectorValue),
  [ColumnOperator.EndsWith]: (entityValue, selectorValue) =>
    entityValue.endsWith(selectorValue),
  [ColumnOperator.Contains]: (entityValue, selectorValue) =>
    entityValue.includes(selectorValue),
};

export const DateConditionOperatorFn: Record<
  DateOperator,
  (entityValue: Date, selectorValue: Date) => boolean
> = {
  [DateOperator.Before]: (entityValue, selectorValue) =>
    entityValue.getTime() < selectorValue.getTime(),
  [DateOperator.After]: (entityValue, selectorValue) =>
    entityValue.getTime() > selectorValue.getTime(),
  [DateOperator.BeforeOrOn]: (entityValue, selectorValue) =>
    entityValue.getTime() <= selectorValue.getTime(),
  [DateOperator.AfterOrOn]: (entityValue, selectorValue) =>
    entityValue.getTime() >= selectorValue.getTime(),
};
