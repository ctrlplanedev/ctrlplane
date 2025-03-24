# Rule Engine

The Ctrlplane Rule Engine is a flexible system for evaluating and selecting
appropriate releases based on configurable criteria.

## Core Concepts

### Rule Engine Architecture

The Rule Engine operates on a simple yet powerful principle: a series of rules
are applied in sequence to filter available releases, with each rule narrowing
down the options until a final release is selected based on priority rules.

```
      ┌─────────────────┐
      │  All Available  │
      │    Releases     │
      └────────┬────────┘
               │
               ▼
┌─────────────────────────────┐
│        Rules Pipeline       │
│  ┌─────────────────────┐    │
│  │     Rule 1          │    │
│  └─────────┬───────────┘    │
│            │                │
│            ▼                │
│  ┌─────────────────────┐    │
│  │     Rule 2          │    │
│  └─────────┬───────────┘    │
│            │                │
│            ▼                │
│  ┌─────────────────────┐    │
│  │     Rule N          │    │
│  └─────────┬───────────┘    │
└────────────┼────────────────┘
             │
             ▼
    ┌─────────────────┐
    │ Release Selection│
    │     Logic       │
    └────────┬────────┘
             │
             ▼
    ┌─────────────────┐
    │  Final Selected │
    │     Release     │
    └─────────────────┘
```

### Key Components

1. **DeploymentResourceContext**: Contains all information for rule evaluation

   - Desired release ID
   - Deployment details
   - Environment information
   - Resource being deployed
   - All available releases

2. **Release**: Represents a deployable version

   - Unique ID
   - Creation timestamp
   - Version information (tag, config, metadata)
   - Variables for deployment

3. **DeploymentResourceRule**: Interface for all rules

   - `name`: Identifying the rule for logging/debugging
   - `filter()`: Method that filters candidate releases

4. **Releases**: Utility class for working with collections of releases

   - Immutable operations (each returns a new instance)
   - Release selection helpers (getOldest, getNewest, etc.)
   - Filtering and sorting operations

5. **RuleEngine**: Coordinates the evaluation process
   - Applies rules sequentially to filter releases
   - Selects the final release based on priority rules
   - Reports success or failure with detailed reasons

## Design Principles

### Rule Implementation Guidelines

Rules should follow these principles:

1. **Return All Valid Candidates**: Rules should return ALL releases that
   satisfy their criteria, not just one. This ensures downstream rules have
   complete information for their filtering logic.

2. **Immutability**: Rules should not modify the input releases collection.
   Instead, they should use the Releases utility class to create new filtered
   collections.

3. **Early Returns**: Rules should check edge cases first (empty collections,
   non-applicable scenarios) to simplify the core logic.

4. **Explicit Reasoning**: When filtering out releases, rules should provide
   clear reasons why, enhancing debugging and user communication.

### Release Selection Priority

The rule engine uses the following priority order when selecting the final
release:

1. If sequential upgrade releases are present, select the oldest one
2. If a desired release ID is specified and that release is in the candidate
   list, select it
3. Otherwise, select the newest release (by creation timestamp)

This ensures that critical sequential upgrades are applied in the correct order,
while respecting user preferences when possible.

## Key Assumptions

The rule engine makes several important assumptions:

1. **Sequential vs. Explicit Order**: Some releases may be flagged as requiring
   sequential application, which overrides desired release selection.

2. **Metadata-Driven Behavior**: Release behavior is often controlled through
   metadata (e.g., "requiresSequentialUpgrade": "true").

3. **Rule Independence**: Each rule should operate independently without relying
   on the outcome of other rules.

4. **Creation Time Order**: Sequential releases are ordered by their creation
   timestamps, with the assumption that older sequential releases must be
   applied before newer ones.

5. **Complete Input Information**: The deployment context contains all necessary
   information for rules to make correct decisions.

6. **Rules Don't Jump Ahead**: Each rule evaluates the candidates filtered by
   previous rules; they can't access the original complete set.

7. **Rules Return All Valid Options**: Unlike traditional filters that might
   return just one "best" option, rules should return all valid candidates for
   downstream rules.

## Common Rules

The engine includes several common rule implementations:

- **SequentialUpgradeRule**: Enforces that critical releases with specific
  migrations or changes are applied in sequence.
- **TimeWindowRule**: Restricts deployments to specified time windows (e.g.,
  business hours only).
- **ApprovalRequiredRule**: Requires approvals for deployments to certain
  environments.
- **VersionCooldownRule**: Enforces a waiting period after release creation
  before deployment.
- **MaintenanceWindowRule**: Blocks deployments during defined maintenance
  periods.
- **ResourceConcurrencyRule**: Limits concurrent deployments of a resource.
- **PreviousDeployStatusRule**: Considers previous deployment status before
  allowing a new one.
- **GradualVersionRolloutRule**: Implements progressive deployment of new
  versions.

## Limitations and Constraints

The Rule Engine, while powerful, has several important limitations to be aware of:

1. **Rule Ordering Sensitivity**: The order in which rules are defined matters
   significantly. Rules are applied sequentially, and each rule only sees the
   candidates that passed previous rules. Plan rule ordering carefully to avoid
   unintended filtering behavior.

2. **No Rule Communication**: Rules cannot directly communicate with each other
   or share state. If rules need to make decisions based on the same
   information, that information must be provided in the context or encoded in
   release metadata.

3. **Immediate Rejection on Empty Results**: If any rule filters out all
   candidates, the evaluation stops immediately. This means later rules won't
   have a chance to run, which could impact observability and debugging.

4. **Creation Timestamp Dependency**: Sequential upgrade ordering relies heavily
   on creation timestamps. If timestamps are incorrect or manipulated,
   sequential upgrade logic may not work correctly.

5. **Limited Rule Flexibility**: Once the rule pipeline begins execution, the
   set of rules and their configuration cannot be changed dynamically based on
   evaluation results.

6. **All-or-Nothing Filtering**: Rules either accept or reject a release;
   there's no concept of partial acceptance or scoring/ranking releases.

7. **No Built-in Backpressure**: The engine has no built-in mechanism to slow
   down or rate-limit deployments based on system health or metrics.

8. **Context Completeness**: The rule engine assumes all necessary information
   is available in the context object. External information cannot be queried
   during rule execution without custom implementation.

9. **Limited Explanations**: While rules can provide reasons for rejection, the
   reason field is a simple string that may not capture the full complexity of
   the decision.

10. **Assumption of Stable Data**: The engine assumes that release information
    remains stable during the evaluation process. If release data changes while
    the engine is evaluating (e.g., metadata is updated, approvals are added),
    unexpected behavior may result. For this reason, evaluation is typically
    wrapped in a mutex to ensure only one evaluation per context runs at a time,
    preventing race conditions.

## Extending the Rule Engine

New rules can be created by implementing the `DeploymentResourceRule` interface:

```typescript
export class MyCustomRule implements DeploymentResourceRule {
  public readonly name = "MyCustomRule";

  constructor(private options: MyCustomRuleOptions) {}

  filter(
    context: DeploymentResourceContext,
    releases: Releases,
  ): DeploymentResourceRuleResult {
    // Custom filtering logic
    const filteredReleases = releases.filter(criteria);

    return {
      allowedReleases: filteredReleases,
      reason: filteredReleases.isEmpty()
        ? "Explanation why no releases matched"
        : undefined,
    };
  }
}
```

Rules should be designed to be:

- Configurable through options
- Stateless in evaluation
- Focused on a single concern
- Explicit in their reasoning when rejecting releases
