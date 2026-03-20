import { describe, expect, it } from "vitest";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { mapTriggerToStatus } from "../run_notification.js";

describe("mapTriggerToStatus", () => {
  it.each([
    ["run:created", JobStatus.Pending],
    ["run:planning", JobStatus.InProgress],
    ["run:needs_attention", JobStatus.ActionRequired],
    ["run:applying", JobStatus.InProgress],
    ["run:completed", JobStatus.Successful],
    ["run:errored", JobStatus.Failure],
  ])("maps trigger %s to %s", (trigger, expected) => {
    expect(mapTriggerToStatus(trigger)).toBe(expected);
  });

  it("returns null for unknown triggers", () => {
    expect(mapTriggerToStatus("run:unknown")).toBeNull();
    expect(mapTriggerToStatus("")).toBeNull();
    expect(mapTriggerToStatus("something:else")).toBeNull();
  });
});
