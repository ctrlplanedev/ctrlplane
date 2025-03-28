import type { Options as RRuleOptions } from "rrule";
import { tz, TZDate } from "@date-fns/tz";
import {
  addMilliseconds,
  differenceInMilliseconds,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { datetime, RRule } from "rrule";

import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
} from "../types.js";
import { Releases } from "../releases.js";

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

export interface DeploymentDenyRuleOptions extends Partial<RRuleOptions> {
  dtend?: Date | null;

  /**
   * Custom reason to return when deployment is denied Defaults to "Deployment
   * denied due to time-based restrictions"
   */
  denyReason?: string;
}

export class DeploymentDenyRule implements DeploymentResourceRule {
  public readonly name = "DeploymentDenyRule";
  private rrule: RRule;
  private denyReason: string;
  private dtend: Date | null;
  private timezone: string;
  private dtstart: Date | null;

  constructor({
    denyReason = "Deployment denied due to time-based restrictions",
    dtend = null,
    dtstart = null,
    until = null,
    ...options
  }: DeploymentDenyRuleOptions) {
    this.denyReason = denyReason;
    const dtStartPartsInTz =
      dtstart != null
        ? getDatePartsInTimeZone(dtstart, options.tzid ?? "UTC")
        : null;

    const untilPartsInTz =
      until != null
        ? getDatePartsInTimeZone(until, options.tzid ?? "UTC")
        : null;

    this.rrule = new RRule({
      ...options,
      tzid: "UTC",
      dtstart:
        dtStartPartsInTz == null
          ? null
          : datetime(
              dtStartPartsInTz.year,
              dtStartPartsInTz.month,
              dtStartPartsInTz.day,
              dtStartPartsInTz.hour,
              dtStartPartsInTz.minute,
              dtStartPartsInTz.second,
            ),

      until:
        untilPartsInTz == null
          ? null
          : datetime(
              untilPartsInTz.year,
              untilPartsInTz.month,
              untilPartsInTz.day,
              untilPartsInTz.hour,
              untilPartsInTz.minute,
              untilPartsInTz.second,
            ),
    });
    this.dtstart = dtstart;
    this.dtend = dtend;
    this.timezone = options.tzid ?? "UTC";
  }

  // For testing: allow injecting a custom "now" timestamp
  protected getCurrentTime(): TZDate {
    return new TZDate();
  }

  filter(
    _: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    const now = this.getCurrentTime();

    // Check if current time matches one of the rrules
    const isDenied = this.isDeniedTime(now);

    if (isDenied) {
      // Return an empty set of allowed releases
      return {
        allowedReleases: Releases.empty(),
        reason: this.denyReason,
      };
    }

    // Allow all releases if time is not denied
    return {
      allowedReleases: releases,
    };
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
    const occurrence = this.rrule.before(
      datetime(
        parts.year,
        parts.month,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
      true,
    );

    const nowFromParts = new Date(
      Date.UTC(
        parts.year, // 2023
        parts.month - 1, // 3-1=2 (March, because Date.UTC months are 0-based)
        parts.day, // 12
        parts.hour, // 17
        parts.minute, // 30
        parts.second, // 0
      ),
    );

    // If there's no occurrence on or before the time, it's not in a denied period
    if (occurrence == null) return false;

    // If dtend is specified, check if time is between occurrence and occurrence + duration
    if (this.dtend != null && this.dtstart != null) {
      const dtstart = this.castTimezone(this.dtstart, this.timezone);
      const dtend = this.castTimezone(this.dtend, this.timezone);

      // Calculate duration in local time to handle DST correctly
      const durationMs = differenceInMilliseconds(dtend, dtstart);
      const occurrenceEnd = addMilliseconds(occurrence, durationMs);
      console.log("occurrenceEnd", occurrenceEnd);
      const nowInTz = this.castTimezone(now, this.timezone);
      console.log("nowInTz", nowInTz);

      console.log(
        `Checking if ${nowInTz.toLocaleDateString()} ${nowInTz.toLocaleTimeString()} is within ${occurrence.toLocaleDateString()} ${occurrence.toLocaleTimeString()} and ${occurrenceEnd.toLocaleDateString()} ${occurrenceEnd.toLocaleTimeString()}`,
      );
      return isWithinInterval(nowFromParts, {
        start: occurrence,
        end: occurrenceEnd,
      });
    }

    // If no dtend, check if the occurrence is on the same day using date-fns
    return isSameDay(occurrence, now, { in: tz(this.timezone) });
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

  /**
   * Formats a date in a specific timezone
   *
   * @param date - The date to format
   * @param timezone - The timezone to format the date in
   * @returns The formatted date string in the specified timezone
   */
  private formatDateInTimezone(date: Date, timezone: string) {
    const formattedTime = date.toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });

    return formattedTime;
  }

  /**
   * Get time of day in seconds (seconds since midnight)
   *
   * @param date - The date to extract time from
   * @returns Seconds since midnight
   */
  private getTimeOfDayInSeconds(date: Date): number {
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  }
}
