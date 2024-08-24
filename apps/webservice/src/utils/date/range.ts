import { add } from "date-fns";

export type TimeUnit = "days" | "months" | "weeks";

/**
 * Generated a range of dates between two dates by step size.
 */
export const dateRange = (
  start: Date,
  stop: Date,
  step: number,
  unit: TimeUnit,
) => {
  const dateArray: Date[] = [];
  let currentDate = start;
  while (currentDate <= stop) {
    dateArray.push(currentDate);
    currentDate = add(currentDate, { [unit]: step });
  }
  return dateArray;
};
