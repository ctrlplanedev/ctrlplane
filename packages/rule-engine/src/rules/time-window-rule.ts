import type {
  DeploymentResourceContext,
  DeploymentResourceRule,
  DeploymentResourceRuleResult,
  Release,
} from "../types.js";

/**
 * Options for configuring the TimeWindowRule
 */
export type TimeWindowRuleOptions = {
  /**
   * Hour to start allowing deployments (0-23)
   */
  startHour: number;
  
  /**
   * Hour to stop allowing deployments (0-23)
   */
  endHour: number;
  
  /**
   * Days of the week to allow deployments
   */
  days?: Array<
    "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"
  >;
  
  /**
   * Optional timezone for time calculations (e.g., "America/New_York")
   */
  timezone?: string;
};

/**
 * A rule that only allows deployments during specific time windows.
 *
 * This rule restricts deployments to occur only during specified time windows,
 * which can be useful for limiting production deployments to business hours
 * or other safe periods.
 *
 * @example
 * ```ts
 * // Allow deployments only during business hours (9am-5pm)
 * new TimeWindowRule({
 *   startHour: 9,
 *   endHour: 17,
 *   days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
 * });
 * ```
 */
export class TimeWindowRule implements DeploymentResourceRule {
  public readonly name = "TimeWindowRule";

  constructor(
    private options: TimeWindowRuleOptions,
  ) {}

  filter(
    ctx: DeploymentResourceContext,
    currentCandidates: Release[],
  ): DeploymentResourceRuleResult {
    const now = new Date();
    const days = this.options.days ?? [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    // Convert to local time if timezone specified
    let localHour = now.getHours();
    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][now.getDay()];

    if (this.options.timezone) {
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: this.options.timezone,
          hour: "numeric",
          hour12: false,
        });
        const formattedTime = formatter.format(now);
        const hourStr = /\d+/.exec(formattedTime)?.[0] ?? "0";
        localHour = parseInt(hourStr, 10);
      } catch {
        return {
          allowedReleases: [],
          reason: `Invalid timezone: ${this.options.timezone}`,
        };
      }
    }

    // Check if current time is within allowed window
    const isAllowedHour =
      localHour >= this.options.startHour && localHour < this.options.endHour;
    const isAllowedDay = days.includes(dayOfWeek as any);

    if (!isAllowedHour || !isAllowedDay) {
      return {
        allowedReleases: [],
        reason: `Deployment not allowed outside of permitted time window (${this.options.startHour}:00-${this.options.endHour}:00 on ${days.join(", ")})`,
      };
    }

    return { allowedReleases: currentCandidates };
  }
}