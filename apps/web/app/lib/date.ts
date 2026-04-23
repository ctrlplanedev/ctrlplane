import {
  formatDistanceStrict,
  formatDistanceToNow,
  formatDistanceToNowStrict,
  type FormatDistanceStrictOptions,
  type FormatDistanceToNowStrictOptions,
} from "date-fns";

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function safeFormatDistanceToNowStrict(
  value: Date | string | null | undefined,
  options?: FormatDistanceToNowStrictOptions,
): string | null {
  const date = toValidDate(value);
  if (date == null) return null;
  return formatDistanceToNowStrict(date, options);
}

export function safeFormatDistanceToNow(
  value: Date | string | null | undefined,
  options?: Parameters<typeof formatDistanceToNow>[1],
): string | null {
  const date = toValidDate(value);
  if (date == null) return null;
  return formatDistanceToNow(date, options);
}

export function safeFormatDistanceStrict(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
  options?: FormatDistanceStrictOptions,
): string | null {
  const dateA = toValidDate(a);
  const dateB = toValidDate(b);
  if (dateA == null || dateB == null) return null;
  return formatDistanceStrict(dateA, dateB, options);
}

export function safeIsPast(value: Date | string | null | undefined): boolean {
  const date = toValidDate(value);
  if (date == null) return false;
  return date.getTime() < Date.now();
}

export function safeIsFuture(value: Date | string | null | undefined): boolean {
  const date = toValidDate(value);
  if (date == null) return false;
  return date.getTime() > Date.now();
}
