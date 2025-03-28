import { TZDate } from "@date-fns/tz";
import { Frequency, RRule } from "rrule";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DeploymentResourceContext, Release } from "../../types.js";
import { Releases } from "../../releases.js";
import { DeploymentDenyRule } from "../deployment-deny-rule.js";

describe("DeploymentDenyRule", () => {
  let releases: Releases;
  let context: DeploymentResourceContext;

  beforeEach(() => {
    // Create a sample set of releases
    const sampleReleases: Release[] = [
      {
        id: "rel-1",
        createdAt: new Date("2023-01-01T12:00:00Z"),
        version: {
          id: "ver-1",
          tag: "v1.0.0",
          config: {},
          metadata: {},
        },
        variables: {},
      },
      {
        id: "rel-2",
        createdAt: new Date("2023-01-02T12:00:00Z"),
        version: {
          id: "ver-2",
          tag: "v1.1.0",
          config: {},
          metadata: {},
        },
        variables: {},
      },
    ];

    releases = new Releases(sampleReleases);

    // Create a sample context
    context = {
      desiredReleaseId: null,
      deployment: {
        id: "deploy-1",
        name: "Test Deployment",
      },
      environment: {
        id: "env-1",
        name: "Test Environment",
      },
      resource: {
        id: "res-1",
        name: "Test Resource",
      },
    };
  });

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

    const result = rule.filter(context, releases);

    // Expect all releases to be allowed
    expect(result.allowedReleases.length).toBe(2);
    expect(result.reason).toBeUndefined();
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
      new TZDate("2023-01-02T12:00:00Z"), // Monday, Jan 2, 2023
    );

    const result = rule.filter(context, releases);

    // Expect no releases to be allowed
    expect(result.allowedReleases.length).toBe(0);
    expect(result.reason).toBe(
      "Deployment denied due to time-based restrictions",
    );
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

    const result = rule.filter(context, releases);

    // Expect the custom reason to be returned
    expect(result.reason).toBe(customReason);
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
    let result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(0);
    expect(result.reason).toBeDefined();

    // Test time outside the denied period (Wednesday at 8:00 AM)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T08:00:00Z"),
    );
    result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(2);
    expect(result.reason).toBeUndefined();

    // Test time outside the denied period (Wednesday at 6:00 PM)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T18:00:00Z"),
    );
    result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(2);
    expect(result.reason).toBeUndefined();
  });

  it("should handle timezone conversions correctly", () => {
    // Create a rule that denies deployments from 9:00 to 17:00 EST on weekdays
    const rule = new DeploymentDenyRule({
      freq: Frequency.WEEKLY,
      byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR], // Weekdays
      dtstart: new Date("2023-01-02T14:00:00Z"), // 9:00 AM EST (UTC-5)
      dtend: new Date("2023-01-02T22:00:00Z"), // 5:00 PM EST (UTC-5)
      tzid: "America/New_York",
    });

    // Test time within the denied period in ET (10:00 AM EST)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-05T15:00:00Z"), // 10:00 AM EST
    );
    let result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(0);
    expect(result.reason).toBeDefined();

    // Test time outside the denied period in ET (8:00 AM EST)
    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-01-04T13:00:00Z"), // 8:00 AM EST
    );
    result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(2);
    expect(result.reason).toBeUndefined();
  });

  it("should handle standard time to daylight time changes correctly (EST -> EDT in March)", () => {
    const rule = new DeploymentDenyRule({
      freq: Frequency.DAILY,
      dtstart: new Date("2023-03-10T14:00:00Z"), // 9:00am EST
      dtend: new Date("2023-03-10T22:00:00Z"), // 5:00pm EST
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
    let result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(0);
    expect(result.reason).toBeDefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-03-12T21:30:00Z"),
    );
    result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(2);
    expect(result.reason).toBeUndefined();
  });

  it("should handle daylight time to standard time changes correctly (EDT -> EST in November)", () => {
    const rule = new DeploymentDenyRule({
      freq: Frequency.DAILY,
      dtstart: new Date("2023-11-04T13:00:00Z"), // 9:00am EDT
      dtend: new Date("2023-11-04T21:00:00Z"), // 5:00pm EDT
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
    let result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(0); // Should be DENIED
    expect(result.reason).toBeDefined();

    vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
      new Date("2023-11-05T13:30:00Z"),
    );
    result = rule.filter(context, releases);
    expect(result.allowedReleases.length).toBe(2); // Should be ALLOWED
    expect(result.reason).toBeUndefined();
  });

  /* OLD TESTS BELOW */

  // it("should handle DST changes correctly", () => {
  //   // Create a rule that denies deployments at 2:30 AM ET every day
  //   // This test will check behavior around the DST change boundary
  //   const rule = new DeploymentDenyRule({
  //     freq: Frequency.DAILY,
  //     dtstart: new Date("2023-03-11T07:30:00Z"), // 2:30 AM ET before DST change
  //     dtend: new Date("2023-03-11T07:45:00Z"), // 2:45 AM ET before DST change
  //     tzid: "America/New_York",
  //   });

  //   // Mock date just before DST change - 2:30 AM EST (March 12, 2023)
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new TZDate("2023-03-12T07:30:00Z", "UTC"), // 2:30 AM EST
  //   );
  //   let result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();

  //   // Mock date just after DST change - 2:30 AM EDT
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new TZDate("2023-03-13T07:30:00Z", "UTC"), // 2:30 AM EDT (UTC-4 after the change)
  //   );
  //   result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();

  //   // Mock a time outside the deny window - 3:30 AM EDT
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new TZDate("2023-03-13T07:30:00Z", "UTC"), // 3:30 AM EDT
  //   );
  //   result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(2);
  //   expect(result.reason).toBeUndefined();
  // });

  // it("should handle DST change in the fall correctly", () => {
  //   // Create a rule that denies deployments at 1:30 AM ET every day
  //   // This will test the "repeated hour" during fall DST change
  //   const rule = new DeploymentDenyRule({
  //     freq: Frequency.DAILY,
  //     dtstart: new Date("2023-11-04T05:30:00Z"), // 1:30 AM EDT before DST change
  //     dtend: new Date("2023-11-04T05:45:00Z"), // 1:45 AM EDT before DST change
  //     tzid: "America/New_York",
  //   });

  //   // 1:30 AM EDT before the change
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new Date("2023-11-05T05:30:00Z"), // 1:30 AM EDT (UTC-4)
  //   );
  //   let result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();

  //   // 1:30 AM EST after the change (the "repeated hour")
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new Date("2023-11-05T06:30:00Z"), // 1:30 AM EST (UTC-5 after the change)
  //   );
  //   result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();
  // });

  // it("should handle complex recurrence rules with DST correctly", () => {
  //   // Create a rule for a maintenance window that happens every Sunday at 2:00 AM local time
  //   const rule = new DeploymentDenyRule({
  //     freq: Frequency.WEEKLY,
  //     byweekday: [RRule.SU], // Sunday
  //     dtstart: new Date("2023-03-05T07:00:00Z"), // 2:00 AM ET, Sunday before DST change
  //     dtend: new Date("2023-03-05T11:00:00Z"), // 6:00 AM ET, Sunday before DST change
  //     timezone: "America/New_York",
  //   });

  //   // Check Sunday March 12, 2023 at 2:30 AM (during DST change)
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new Date("2023-03-12T07:30:00Z"), // 2:30 AM EST during DST change
  //   );
  //   let result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();

  //   // Check Sunday April 2, 2023 at 2:30 AM (after DST change)
  //   vi.spyOn(rule as any, "getCurrentTime").mockReturnValue(
  //     new Date("2023-04-02T06:30:00Z"), // 2:30 AM EDT after DST change (UTC-4)
  //   );
  //   result = rule.filter(context, releases);
  //   expect(result.allowedReleases.length).toBe(0);
  //   expect(result.reason).toBeDefined();
  // });
});
