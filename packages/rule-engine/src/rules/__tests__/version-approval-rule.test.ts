import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedRelease, RuleEngineContext } from "../../types.js";
import type { GetApprovalRecordsFunc } from "../version-approval-rule.js";
import { Releases } from "../../releases.js";
import { VersionApprovalRule } from "../version-approval-rule.js";

describe("VersionApprovalRule", () => {
  let releases: Releases;
  let context: RuleEngineContext;
  let mockGetApprovalRecords: ReturnType<typeof vi.fn<GetApprovalRecordsFunc>>;

  beforeEach(() => {
    // Create a sample set of releases
    const sampleReleases: ResolvedRelease[] = [
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

    // Create a mock getApprovalRecords function
    mockGetApprovalRecords = vi.fn().mockResolvedValue([]);
  });

  it("should reject all releases if minApprovals is not met", async () => {
    mockGetApprovalRecords.mockResolvedValue([]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const result = await rule.filter(context, releases);

    expect(result.allowedReleases.length).toBe(0);
    expect(mockGetApprovalRecords).toHaveBeenCalledWith(context, [
      "ver-1",
      "ver-2",
    ]);
  });

  it("should allow releases with sufficient approvals", async () => {
    mockGetApprovalRecords.mockResolvedValue([
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-2",
        reason: null,
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 2,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const result = await rule.filter(context, releases);

    expect(result.allowedReleases.length).toBe(1);
    expect(result.allowedReleases.getAll()[0]!.id).toBe("rel-1");
  });

  it("should reject releases with any rejections regardless of approvals", async () => {
    mockGetApprovalRecords.mockResolvedValue([
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-2",
        reason: null,
      },
      {
        versionId: "ver-1",
        status: "rejected",
        userId: "user-3",
        reason: "Security issue",
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const result = await rule.filter(context, releases);

    expect(result.allowedReleases.length).toBe(0);
    expect(result.rejectionReasons?.get("rel-1")).toBe(
      "Has been rejected by 1 users.",
    );
  });

  it("should allow all releases if minApprovals is 0", async () => {
    mockGetApprovalRecords.mockResolvedValue([]);

    const rule = new VersionApprovalRule({
      minApprovals: 0,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const result = await rule.filter(context, releases);

    expect(result.allowedReleases.length).toBe(2);
  });

  it("should handle mixed approval scenarios correctly", async () => {
    mockGetApprovalRecords.mockResolvedValue([
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
      {
        versionId: "ver-2",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
      {
        versionId: "ver-2",
        status: "rejected",
        userId: "user-2",
        reason: "Not ready for production",
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const result = await rule.filter(context, releases);

    expect(result.allowedReleases.length).toBe(1);
    expect(result.allowedReleases.getAll()[0]!.id).toBe("rel-1");
    expect(result.rejectionReasons?.get("rel-2")).toBe(
      "Has been rejected by 1 users.",
    );
  });

  it("should test different approval record retrieval functions", async () => {
    // Test with getAnyApprovalRecords mock
    const anyRecordsMock = vi.fn().mockResolvedValue([
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
    ]);

    const anyRule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: anyRecordsMock,
    });

    const anyResult = await anyRule.filter(context, releases);
    expect(anyResult.allowedReleases.length).toBe(1);
    expect(anyRecordsMock).toHaveBeenCalledWith(context, ["ver-1", "ver-2"]);

    // Test with getRoleApprovalRecords mock
    const roleRecordsMock = vi.fn().mockResolvedValue([
      {
        versionId: "ver-2",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
    ]);

    const roleRule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: roleRecordsMock,
    });

    const roleResult = await roleRule.filter(context, releases);
    expect(roleResult.allowedReleases.length).toBe(1);
    expect(roleResult.allowedReleases.getAll()[0]!.id).toBe("rel-2");
    expect(roleRecordsMock).toHaveBeenCalledWith(context, ["ver-1", "ver-2"]);
  });
});
