import { tz, TZDate } from "@date-fns/tz";
import {
  addMilliseconds,
  differenceInMilliseconds,
  isSameDay,
  isWithinInterval,
  subHours,
} from "date-fns";
import * as rrule from "rrule";

import type {
  RuleEngineContext,
  RuleEngineFilter,
  RuleEngineRuleResult,
} from "../types.js";

// https://github.com/jkbrzt/rrule/issues/478
// common js bs
const { datetime, RRule } = rrule;

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10),
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

export interface DeploymentDenyRuleOptions<T> extends Partial<rrule.Options> {
  dtend?: Date | null;

  /**
   * Custom reason to return when deployment is denied Defaults to "Deployment
   * denied due to time-based restrictions"
   */
  denyReason?: string;

  getCandidateId(this: void, candidate: T): string;
}

export class DeploymentDenyRule<T> implements RuleEngineFilter<T> {
  public readonly name = "DeploymentDenyRule";
  private rrule: rrule.RRule;
  private denyReason: string;
  private dtend: Date | null;
  private timezone: string;
  private dtstart: Date | null;
  private getCandidateId: (candidate: T) => string;

  constructor({
    denyReason = "Deployment denied due to time-based restrictions",
    dtend = null,
    dtstart = null,
    until = null,
    getCandidateId,
    ...options
  }: DeploymentDenyRuleOptions<T>) {
    this.timezone = options.tzid ?? "UTC";
    this.denyReason = denyReason;

    this.getCandidateId = getCandidateId;

    const dtStartCasted =
      dtstart != null ? this.castTimezone(dtstart, this.timezone) : null;

    const untilCasted =
      until != null ? this.castTimezone(until, this.timezone) : null;

    this.rrule = new RRule({
      ...options,
      tzid: "UTC",
      dtstart: dtStartCasted,
      until: untilCasted,
    });
    this.dtstart = dtstart;
    this.dtend = dtend;
  }

  // For testing: allow injecting a custom "now" timestamp
  protected getCurrentTime() {
    return new Date();
  }

  filter(_: RuleEngineContext, candidates: T[]): RuleEngineRuleResult<T> {
    const now = this.getCurrentTime();

    // Check if current time matches one of the rrules
    const isDenied = this.isDeniedTime(now);

    if (isDenied) {
      // Build rejection reasons for each release
      const rejectionReasons = new Map<string, string>(
        candidates.map((candidate) => [
          this.getCandidateId(candidate),
          this.denyReason,
        ]),
      );
      return { allowedCandidates: [], rejectionReasons };
    }

    // Allow all releases if time is not denied
    return { allowedCandidates: candidates };
  }

  /**
   * Checks if the given time is within a denied period
   *
   * @param time - The time to check
   * @returns true if deployments should be denied at this time
   */
  private isDeniedTime(now: Date): boolean {
    // now is in whatever timezone of the server. We need to convert it to match
    // the timezone for the library
    const parts = getDatePartsInTimeZone(now, this.timezone);
    const nowDt = datetime(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );

    const occurrence = this.rrule.before(nowDt, true);

    // If there's no occurrence on or before the time, it's not in a denied
    // period
    if (occurrence == null) return false;

    // If dtend is specified, check if time is between occurrence and occurrence
    // + duration
    if (this.dtend != null && this.dtstart != null) {
      const dtstart = this.castTimezone(this.dtstart, this.timezone);
      const dtend = this.castTimezone(this.dtend, this.timezone);

      // Calculate duration in local time to handle DST correctly
      const durationMs = differenceInMilliseconds(dtend, dtstart);
      const occurrenceEnd = addMilliseconds(occurrence, durationMs);

      return isWithinInterval(nowDt, {
        start: occurrence,
        end: occurrenceEnd,
      });
    }

    // If no dtend, check if the occurrence is on the same day using date-fns
    return isSameDay(occurrence, now, { in: tz(this.timezone) });
  }

  /**
   * Returns all denied windows within a given date range
   *
   * @param start - Start of the date range to check (inclusive)
   * @param end - End of the date range to check (inclusive)
   * @returns Array of denied windows, where each window has a start and end time
   */
  getWindowsInRange(start: Date, end: Date): Array<{ start: Date; end: Date }> {
    // since the rrule just treats its internal timezone as UTC, we need to convert
    // the requested times to the rule's timezone
    const startParts = getDatePartsInTimeZone(start, this.timezone);
    const endParts = getDatePartsInTimeZone(end, this.timezone);
    const startDt = datetime(
      startParts.year,
      startParts.month,
      startParts.day,
      startParts.hour,
      startParts.minute,
      startParts.second,
    );
    const endDt = datetime(
      endParts.year,
      endParts.month,
      endParts.day,
      endParts.hour,
      endParts.minute,
      endParts.second,
    );

    const occurrences = this.rrule.between(startDt, endDt, true);

    if (occurrences.length === 0) return [];

    // Calculate duration if dtend is specified
    const durationMs =
      this.dtend != null && this.dtstart != null
        ? differenceInMilliseconds(this.dtend, this.dtstart)
        : 0;

    // Create windows for each occurrence
    return occurrences.map((occurrence) => {
      const windowStart = occurrence;
      const windowEnd =
        this.dtend != null
          ? addMilliseconds(occurrence, durationMs)
          : this.castTimezone(
              new Date(
                occurrence.getFullYear(),
                occurrence.getMonth(),
                occurrence.getDate(),
                23,
                59,
                59,
              ),
              this.timezone,
            );

      /**
       * Window start and end are in the rrule's internal pretend UTC timezone
       * Since we know the rule's timezone, we first figure out the offset of this timezone
       * to the actual UTC time. Then we convert the window start and end to the actual UTC time
       * by subtracting the offset. We end up not needing to know the requester's timezone at all
       * because timezone in parts will
       */
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: this.timezone,
        timeZoneName: "longOffset",
      });

      const offsetStr = formatter.format(windowStart).split("GMT")[1];
      const offsetHours = parseInt(offsetStr?.split(":")[0] ?? "0", 10);

      const realStartUTC = subHours(windowStart, offsetHours);
      const realEndUTC = subHours(windowEnd, offsetHours);

      // Create UTC dates using Date.UTC to get the correct UTC time

      return { start: realStartUTC, end: realEndUTC };
    });
  }

  /**
   * Converts a date to the specified timezone
   *
   * @param date - The date to convert
   * @param timezone - The timezone to convert to
   * @returns The date adjusted for the timezone
   */
  private castTimezone(date: Date, timezone: string): TZDate {
    return new TZDate(date, timezone);
  }
}
