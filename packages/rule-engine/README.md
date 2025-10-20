# Rule Engine

A TypeScript package for evaluating deployments against defined rules to
determine if they are allowed and which release should be chosen.

## Overview

The Rule Engine provides a framework for validating deployments based on
configurable rules. It follows a chain-of-responsibility pattern where rules are
applied sequentially to filter candidate releases.

## Core Components

- **RuleEngine**: The main class that sequentially applies rules to filter
  candidate releases and selects the most appropriate one.
- **DeploymentResourceRule**: Interface that all rules must implement with a
  `filter` method.
- **Releases**: Utility class for managing collections of releases.
- **DeploymentDenyRule**: Blocks deployments based on time restrictions using
  recurrence rules.

## How It Works

1. Rule evaluation process:
   - Starts with all available releases
   - Applies each rule sequentially
   - Updates the candidate list after each rule
   - If any rule disqualifies all candidates, evaluation stops with denial
   - After all rules pass, selects the final release

2. Release selection follows these priorities:
   - Sequential upgrade releases get priority (oldest first)
   - Specified desired release if available
   - Otherwise, newest release by creation date

3. Tracking rejection reasons:
   - Each rule provides specific reasons for rejecting individual releases
   - The engine tracks these reasons per release ID across all rules
   - The final result includes a map of rejected release IDs to their rejection reasons
   - This approach eliminates the need for a general reason field, providing more detailed feedback

## Usage

```typescript
// Create rule instances
const denyRule = new DeploymentDenyRule({
  // Configure time restrictions
  recurrence: {
    freq: Frequency.WEEKLY,
    byday: [DayOfWeek.SA, DayOfWeek.SU],
  },
  timezone: "America/New_York",
});

// Create the rule engine
const engine = new RuleEngine([denyRule]);

// Evaluate against releases
const result = engine.evaluate(availableReleases, context);

// Check result
if (result.allowed) {
  // Use result.chosenRelease
} else {
  // Examine specific release rejection reasons
  if (result.rejectionReasons) {
    for (const [releaseId, reason] of result.rejectionReasons.entries()) {
      console.log(`Release ${releaseId} was rejected because: ${reason}`);
    }
  }
}
```

## Extending

Create new rules by implementing the `DeploymentResourceRule` interface:

```typescript
class MyCustomRule implements DeploymentResourceRule {
  filter(context: DeploymentContext, releases: Releases): RuleResult {
    // Track rejection reasons
    const rejectionReasons = new Map<string, string>();

    // Custom logic to filter releases
    const filteredReleases = releases.filter(release => {
      // Determine if release meets criteria
      const meetsCondition = /* your condition logic */;

      // Track rejection reasons for releases that don't meet criteria
      if (!meetsCondition) {
        rejectionReasons.set(release.id, "Failed custom condition check");
      }

      return meetsCondition;
    });

    return {
      allowedReleases: new Releases(filteredReleases),
      rejectionReasons // Map of release IDs to rejection reasons
    };
  }
}
```

Add custom rules to the engine to extend functionality while maintaining the
existing evaluation flow.
