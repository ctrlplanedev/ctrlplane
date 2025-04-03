import { addMonths, addWeeks, isBefore, isWithinInterval } from "date-fns";

/**
 *
 * @param date
 * @param startDate
 * @param endDate
 * @param recurrence
 * @returns Whether the date is in the time window defined by the start and end
 * date
 */
export const isDateInTimeWindow = (
  date: Date,
  startDate: Date,
  endDate: Date,
  recurrence: string,
) => {
  let intervalStart = startDate;
  let intervalEnd = endDate;

  const addTimeFunc: (date: string | number | Date, amount: number) => Date =
    recurrence === "weekly" ? addWeeks : addMonths;

  while (isBefore(intervalStart, date)) {
    if (isWithinInterval(date, { start: intervalStart, end: intervalEnd }))
      return { isInWindow: true, nextIntervalStart: intervalStart };

    intervalStart = addTimeFunc(intervalStart, 1);
    intervalEnd = addTimeFunc(intervalEnd, 1);
  }

  return { isInWindow: false, nextIntervalStart: intervalStart };
};

// this is a test
