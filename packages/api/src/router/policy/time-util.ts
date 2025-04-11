import { getDatePartsInTimeZone } from "@ctrlplane/rule-engine";

export const getLocalDateAsUTC = (date: Date, timeZone: string) => {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return new Date(
    Date.UTC(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );
};
