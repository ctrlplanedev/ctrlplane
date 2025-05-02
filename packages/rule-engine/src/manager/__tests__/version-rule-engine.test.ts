import { beforeEach, describe, expect, it } from "vitest";

import type { FilterRule, RuleEngineRuleResult } from "../../types.js";
import type { Version } from "../version-rule-engine.js";
import { VersionRuleEngine } from "../version-rule-engine.js";

// Mock rule implementation
class MockRule implements FilterRule<Version> {
  public readonly name = "MockRule";
  constructor(private readonly allowedIds: string[]) {}

  filter(candidates: Version[]): RuleEngineRuleResult<Version> {
    const rejectionReasons = new Map<string, string>();
    const allowedCandidates = candidates.filter((candidate) => {
      if (this.allowedIds.includes(candidate.id)) {
        return true;
      }
      rejectionReasons.set(candidate.id, `Rejected by ${this.name}`);
      return false;
    });

    return { allowedCandidates, rejectionReasons };
  }
}

describe("VersionRuleEngine", () => {
  let candidates: Version[];

  beforeEach(() => {
    // Create sample versions
    candidates = [
      {
        id: "ver-1",
        tag: "v1.0.0",
        config: {},
        metadata: {},
        createdAt: new Date("2023-01-01T12:00:00Z"),
      },
      {
        id: "ver-2",
        tag: "v1.1.0",
        config: {},
        metadata: {},
        createdAt: new Date("2023-01-02T12:00:00Z"),
      },
      {
        id: "ver-3",
        tag: "v1.2.0",
        config: {},
        metadata: { requiresSequentialUpgrade: "true" },
        createdAt: new Date("2023-01-03T12:00:00Z"),
      },
      {
        id: "ver-4",
        tag: "v1.3.0",
        config: {},
        metadata: { requiresSequentialUpgrade: "true" },
        createdAt: new Date("2023-01-04T12:00:00Z"),
      },
    ];
  });

  it("should apply rules in sequence", async () => {
    // Set up rules to filter out specific versions
    const rule1 = new MockRule(["ver-1", "ver-2", "ver-3"]);
    const rule2 = new MockRule(["ver-2", "ver-3"]);

    const engine = new VersionRuleEngine([rule1, rule2]);
    const result = await engine.evaluate(candidates);

    expect(result.chosenCandidate).not.toBeNull();
    expect(result.chosenCandidate?.id).toBe("ver-3");
    expect(result.rejectionReasons.get("ver-1")).toBe("Rejected by MockRule");
    expect(result.rejectionReasons.get("ver-4")).toBe("Rejected by MockRule");
  });

  it("should return null when all candidates are filtered out", async () => {
    // Set up rules to filter out all versions
    const rule1 = new MockRule([]);

    const engine = new VersionRuleEngine([rule1]);
    const result = await engine.evaluate(candidates);

    expect(result.chosenCandidate).toBeNull();
    expect(result.rejectionReasons.size).toBe(4);
  });

  it("should select the oldest sequential upgrade version when present", async () => {
    // Set up rule that allows all versions
    const rule1 = new MockRule(["ver-1", "ver-2", "ver-3", "ver-4"]);

    const engine = new VersionRuleEngine([rule1]);
    const result = await engine.evaluate(candidates);

    expect(result.chosenCandidate).not.toBeNull();
    expect(result.chosenCandidate?.id).toBe("ver-3"); // Should pick ver-3 as it's the oldest sequential upgrade
  });

  it("should select the newest version when no sequential upgrades are present", async () => {
    // Set up rule that allows only non-sequential versions
    const rule1 = new MockRule(["ver-1", "ver-2"]);

    const engine = new VersionRuleEngine([rule1]);
    const result = await engine.evaluate(candidates);

    expect(result.chosenCandidate).not.toBeNull();
    expect(result.chosenCandidate?.id).toBe("ver-2"); // Should pick ver-2 as it's the newest non-sequential
  });

  it("should handle empty candidates array", async () => {
    const engine = new VersionRuleEngine([]);
    const result = await engine.evaluate([]);

    expect(result.chosenCandidate).toBeNull();
  });

  it("should accumulate rejection reasons across multiple rules", async () => {
    // First rule rejects ver-4
    const rule1 = new MockRule(["ver-1", "ver-2", "ver-3"]);
    // Second rule rejects ver-1
    const rule2 = new MockRule(["ver-2", "ver-3"]);
    // Third rule rejects ver-2
    const rule3 = new MockRule(["ver-3"]);

    const engine = new VersionRuleEngine([rule1, rule2, rule3]);
    const result = await engine.evaluate(candidates);

    expect(result.chosenCandidate?.id).toBe("ver-3");
    expect(result.rejectionReasons.size).toBe(3);
    expect(result.rejectionReasons.get("ver-1")).toBe("Rejected by MockRule");
    expect(result.rejectionReasons.get("ver-2")).toBe("Rejected by MockRule");
    expect(result.rejectionReasons.get("ver-4")).toBe("Rejected by MockRule");
  });
});
