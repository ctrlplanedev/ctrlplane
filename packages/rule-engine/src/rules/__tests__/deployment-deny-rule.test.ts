import { Frequency, RRule } from "rrule";
import { describe, expect, it, vi } from "vitest";

import { DeploymentDenyRule } from "../deployment-deny-rule.js";

export type ResolvedRelease = {
  id: string;
  createdAt: Date;
  version: {
    id: string;
    tag: string;
    config: Record<string, any>;
    metadata: Record<string, string>;
  };
  variables: Record<string, unknown>;
};

describe("DeploymentDenyRule", () => {
  it("should allow deployments when not in a denied period", () => {
    // Create a rule that denies deployments on Mondays
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO], // Monday
      dtstart: new Date("2023-01-01T00:00:00Z"),
    });

    // Mock getCurrentTime to return a Sunday
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-08T12:00:00Z"), // Sunday
    );

    const result = rule.passing();

    // Expect all releases to be allowed
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should deny deployments when in a denied period", () => {
    // Create a rule that denies deployments on Mondays
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO], // Monday
      dtstart: new Date("2023-01-02T00:00:00Z"), // Monday
      tzid: "UTC",
    });

    // Mock getCurrentTime to return a Monday
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-02T12:00:00Z"), // Monday, Jan 2, 2023
    );

    const result = rule.passing();

    // Expect no releases to be allowed
    expect(result.passing).toBe(false);
    expect(result.rejectionReason).toBeDefined();
  });

  it("should respect the custom deny reason", () => {
    const customReason = "Maintenance window in progress";
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO], // Monday
      dtstart: new Date("2023-01-02T00:00:00Z"), // Monday
      denyReason: customReason,
    });

    // Mock getCurrentTime to return a Monday
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-02T12:00:00Z"), // Monday, Jan 2, 2023
    );

    const result = rule.passing();

    // Expect the custom reason to be returned
    expect(result.rejectionReason).toBeDefined();
    expect(result.rejectionReason).toBe(customReason);
  });

  it("should check for specific time intervals when dtend is specified", () => {
    // Create a rule that denies deployments from 9:00 to 17:00 on weekdays
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR], // Weekdays
      dtstart: new Date("2023-01-02T09:00:00Z"), // 9:00 AM
      dtend: new Date("2023-01-02T17:00:00Z"), // 5:00 PM
      tzid: "UTC",
    });

    // Test time within the denied period (Wednesday at 10:00 AM)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T10:00:00Z"),
    );
    let result = rule.passing();
    expect(result.passing).toBe(false);
    expect(result.rejectionReason).toBeDefined();

    // Test time outside the denied period (Wednesday at 8:00 AM)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T08:00:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();

    // Test time outside the denied period (Wednesday at 6:00 PM)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T18:00:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should handle timezone conversions correctly", () => {
    // Create a rule that denies deployments from 9:00 to 17:00 EST on weekdays
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR], // Weekdays
      dtstart: new Date("2023-01-02T09:00:00Z"), // 9:00 AM EST (UTC-5)
      dtend: new Date("2023-01-02T17:00:00Z"), // 5:00 PM EST (UTC-5)
      tzid: "America/New_York",
    });

    // Test time within the denied period in ET (10:00 AM EST)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-05T15:00:00Z"), // 10:00 AM EST
    );
    let result = rule.passing();
    expect(result.passing).toBe(false);
    expect(result.rejectionReason).toBeDefined();

    // Test time outside the denied period in ET (8:00 AM EST)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T13:00:00Z"), // 8:00 AM EST
    );
    result = rule.passing();
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should handle standard time to daylight time changes correctly (EST -> EDT in March)", () => {
    const rule = new DeploymentDenyRule({
      freq: Frequency.DAILY,
      dtstart: new Date("2023-03-09T09:00:00Z"), // 9:00am EST
      dtend: new Date("2023-03-09T17:00:00Z"), // 5:00pm EST
      tzid: "America/New_York",
    });

    /**
     * These test UTC 21:30
     * during EST, this is 4:30pm, which is during the denied period
     * during EDT, this is 5:30pm, which is outside the denied period
     * hence, before the DST change, the rule should deny access,
     * and should allow access after the DST change
     */
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-03-11T21:30:00Z"),
    );
    let result = rule.passing();
    expect(result.passing).toBe(false);
    expect(result.rejectionReason).toBeDefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-03-12T21:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();

    /**
     * These test UTC 13:30
     * during EST, this is 8:30am, which is during the denied period
     * during EDT, this is 9:30am, which is outside the denied period
     * hence, before the DST change, the rule should deny access,
     * and should allow access after the DST change
     */
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-03-11T13:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(false);
    expect(result.rejectionReason).toBeDefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-03-12T13:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true);
    expect(result.rejectionReason).toBeUndefined();
  });

  it("should handle daylight time to standard time changes correctly (EDT -> EST in November)", () => {
    const rule = new DeploymentDenyRule({
      freq: Frequency.DAILY,
      dtstart: new Date("2023-11-04T09:00:00Z"), // 9:00am EDT
      dtend: new Date("2023-11-04T17:00:00Z"), // 5:00pm EDT
      tzid: "America/New_York",
    });

    /**
     * These test UTC 13:30
     * during EDT, this is 9:30am, which is during the denied period
     * during EST, this is 8:30am, which is outside the denied period
     * hence, before the DST change, the rule should deny access,
     * and should allow access after the DST change
     */
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-11-04T13:30:00Z"),
    );
    let result = rule.passing();
    expect(result.passing).toBe(false); // Should be DENIED
    expect(result.rejectionReason).toBeDefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-11-05T13:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true); // Should be ALLOWED
    expect(result.rejectionReason).toBeUndefined();

    /**
     * These test UTC 21:30
     * during EDT, this is 5:30pm, which is outside the denied period
     * during EST, this is 4:30pm, which is during the denied period
     * hence, before the DST change, the rule should allow access,
     * and should deny access after the DST change
     */
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-11-04T21:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(true); // Should be ALLOWED
    expect(result.rejectionReason).toBeUndefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-11-05T21:30:00Z"),
    );
    result = rule.passing();
    expect(result.passing).toBe(false); // Should be DENIED
    expect(result.rejectionReason).toBeDefined();
  });
});
