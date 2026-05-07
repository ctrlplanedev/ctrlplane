import { describe, expect, it } from "vitest";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { mapTriggerToStatus } from "../workflow.js";

describe("mapTriggerToStatus", () => {
  it.each([
    ["Pending", JobStatus.Pending],
    ["Running", JobStatus.InProgress],
    ["Succeeded", JobStatus.Successful],
    ["Failed", JobStatus.Failure],
    ["Error", JobStatus.Failure],
  ])("maps Argo phase %s to %s", (phase, expected) => {
    expect(mapTriggerToStatus(phase)).toBe(expected);
  });

  it("returns null for unknown phases", () => {
    expect(mapTriggerToStatus("Skipped")).toBeNull();
    expect(mapTriggerToStatus("")).toBeNull();
    expect(mapTriggerToStatus("succeeded")).toBeNull();
  });
});
