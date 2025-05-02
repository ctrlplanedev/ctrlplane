import { describe, expect, it, vi } from "vitest";

import { VersionApprovalRule } from "../version-approval-rule.js";

describe("VersionApprovalRule", () => {
  it("should filter out versions with no approvals when minApprovals > 0", async () => {
    const mockGetApprovalRecords = vi.fn().mockResolvedValue([]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const result = await rule.filter(candidates);

    expect(result.allowedCandidates.length).toBe(0);
    expect(result.rejectionReasons).toBeDefined();
    expect(mockGetApprovalRecords).toHaveBeenCalledWith(["ver-1", "ver-2"]);
  });

  it("should filter out rejected versions regardless of approval count", async () => {
    const mockGetApprovalRecords = vi.fn().mockResolvedValue([
      {
        versionId: "ver-1",
        status: "rejected",
        userId: "user-1",
        reason: "Found a bug",
      },
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-2",
        reason: null,
      },
      {
        versionId: "ver-1",
        status: "approved",
        userId: "user-3",
        reason: null,
      },
      {
        versionId: "ver-2",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const result = await rule.filter(candidates);

    expect(result.allowedCandidates.length).toBe(1);
    expect(result.allowedCandidates[0]?.id).toBe("ver-2");
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.get("ver-1")).toBe(
      "Has been rejected by 1 users.",
    );
  });

  it("should allow versions with sufficient approvals", async () => {
    const mockGetApprovalRecords = vi.fn().mockResolvedValue([
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
        versionId: "ver-2",
        status: "approved",
        userId: "user-1",
        reason: null,
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 2,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const result = await rule.filter(candidates);

    expect(result.allowedCandidates.length).toBe(1);
    expect(result.allowedCandidates[0]?.id).toBe("ver-1");
    expect(result.rejectionReasons).toBeDefined();
  });

  it("should handle minApprovals=0 case correctly", async () => {
    const mockGetApprovalRecords = vi.fn().mockResolvedValue([]);

    const rule = new VersionApprovalRule({
      minApprovals: 0,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const result = await rule.filter(candidates);

    expect(result.allowedCandidates.length).toBe(2);
    expect(result.rejectionReasons).toBeDefined();
    // Map should be empty
    expect(result.rejectionReasons?.size).toBe(0);
  });

  it("should handle multiple rejections correctly", async () => {
    const mockGetApprovalRecords = vi.fn().mockResolvedValue([
      {
        versionId: "ver-1",
        status: "rejected",
        userId: "user-1",
        reason: "Found a bug",
      },
      {
        versionId: "ver-1",
        status: "rejected",
        userId: "user-2",
        reason: "Security issue",
      },
      {
        versionId: "ver-2",
        status: "rejected",
        userId: "user-1",
        reason: "Not ready",
      },
    ]);

    const rule = new VersionApprovalRule({
      minApprovals: 1,
      getApprovalRecords: mockGetApprovalRecords,
    });

    const candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date(),
      },
    ];

    const result = await rule.filter(candidates);

    expect(result.allowedCandidates.length).toBe(0);
    expect(result.rejectionReasons).toBeDefined();
    expect(result.rejectionReasons?.get("ver-1")).toBe(
      "Has been rejected by 2 users.",
    );
    expect(result.rejectionReasons?.get("ver-2")).toBe(
      "Has been rejected by 1 users.",
    );
  });
});
