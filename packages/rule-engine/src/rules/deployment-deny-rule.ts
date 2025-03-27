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
    this.rrule = new RRule({
      ...options,
      dtstart:
        dtstart == null
          ? null
          : datetime(
              dtstart.getUTCFullYear(),
              dtstart.getUTCMonth(),
              dtstart.getUTCDate(),
              dtstart.getUTCHours(),
              dtstart.getUTCMinutes(),
              dtstart.getUTCSeconds(),
            ),

      until:
        until == null
          ? null
          : datetime(
              until.getUTCFullYear(),
              until.getUTCMonth(),
              until.getUTCDate(),
              until.getUTCHours(),
              until.getUTCMinutes(),
              until.getUTCSeconds(),
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
    console.log(
      "parts",
      parts,
      datetime(
        parts.year,
        parts.month,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
      ),
    );
    const o = this.rrule.before(
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

    // If there's no occurrence on or before the time, it's not in a denied period
    if (o == null) return false;

    console.log("o", o);
    const occurrence = this.castTimezone(o, this.timezone);
    console.log("------");
    console.log("timezone", this.timezone);
    console.log("now", this.formatDateInTimezone(now, this.timezone));
    console.log(
      "occurrence",
      this.formatDateInTimezone(occurrence, this.timezone),
    );

    // If dtend is specified, check if time is between occurrence and occurrence + duration
    if (this.dtend != null && this.dtstart != null) {
      const dtstart = this.castTimezone(this.dtstart, this.timezone);
      const dtend = this.castTimezone(this.dtend, this.timezone);

      // Calculate duration in local time to handle DST correctly
      const durationMs = differenceInMilliseconds(dtend, dtstart);
      const occurrenceEnd = addMilliseconds(occurrence, durationMs);

      console.log("------");
      console.log("timezone", this.timezone);
      console.log("now", this.formatDateInTimezone(now, this.timezone));
      console.log("dtstart", this.formatDateInTimezone(dtstart, this.timezone));
      console.log("dtend", this.formatDateInTimezone(dtend, this.timezone));
      console.log(
        "occurrenceTimezone",
        this.formatDateInTimezone(occurrence, this.timezone),
      );
      console.log(
        "occurrence",
        this.formatDateInTimezone(occurrence, this.timezone),
      );
      console.log(
        "occurrenceEnd",
        this.formatDateInTimezone(occurrenceEnd, this.timezone),
      );
      // console.log("------");
      // console.log("now", now);
      // this.formatDateInTimezone(now, this.timezone);
      // console.log("occurrenceTimezone", occurrenceTimezone);
      // console.log("occurrenceEnd", occurrenceEnd);

      // this.formatDateInTimezone(now, "UTC");
      // this.formatDateInTimezone(occurrenceTimezone, "UTC");
      // this.formatDateInTimezone(occurrenceEnd, "UTC");
      // Check if current time is between occurrence start and end times

      console.log(
        "checking",
        new Date(now),
        new Date(occurrence),
        new Date(occurrenceEnd),
      );
      return isWithinInterval(
        now,
        {
          start: occurrence,
          end: occurrenceEnd,
        },
        { in: tz(this.timezone) },
      );
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
