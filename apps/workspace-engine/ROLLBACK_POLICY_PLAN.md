# Rollback Policy Rule - Implementation Plan

## Overview

Implement a **Rollback Policy Rule** that evaluates whether a version should be blocked based on the success/failure rate of its deployments and verifications across release targets matching the policy selector.

This is **not** an "action" that triggers rollback—it's an **evaluator** that denies a version when failure conditions are met. The planner will naturally select an older version that passes all evaluators.

---

## Key Design Decisions

| Decision               | Details                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Type**               | Policy rule with its own evaluator (like `approval`, `environmentProgression`, etc.)                               |
| **Evaluation Scope**   | All release targets matching the policy selector where this version has been deployed                              |
| **Job Selection**      | Only the **latest job** per release target for the version is considered                                           |
| **Success Criteria**   | Job successful + verifications passed (if required)                                                                |
| **Failure Action**     | Deny the version for the release target being evaluated (not mark version as globally failed)                      |
| **Execution Order**    | Runs **last** among evaluators (other failures take precedence, and this evaluator depends on deployment outcomes) |
| **Policy Interaction** | Isolated—rollback evaluation doesn't consider other policies, just job/verification outcomes                       |

---

## Rollback Rule Schema

```jsonnet
// In oapi/spec/schemas/policy.jsonnet

RollbackRule: {
  type: 'object',
  properties: {
    // Success threshold - version is blocked if success rate falls below this
    minimumSuccessPercentage: {
      type: 'number',
      format: 'float',
      minimum: 0,
      maximum: 100,
      description: 'Minimum percentage of successful deployments (job + verification) required across matching release targets. If below this threshold, the version is blocked.',
      example: 80,
    },

    // Failure threshold - version is blocked if failure count exceeds this
    failureThreshold: {
      type: 'integer',
      format: 'int32',
      minimum: 1,
      description: 'Maximum number of failed deployments allowed across matching release targets. If exceeded, the version is blocked.',
      example: 2,
    },

    // What statuses count as "success" for jobs
    successStatuses: {
      type: 'array',
      items: { $ref: '#/components/schemas/JobStatus' },
      description: 'Job statuses considered successful. Defaults to ["successful"].',
    },

    // Whether to include verification status in success criteria
    requireVerificationSuccess: {
      type: 'boolean',
      default: true,
      description: 'If true, verifications must also pass for a deployment to be considered successful.',
    },
  },
},
```

### Example Configurations

**Conservative rollback (2 failures = rollback):**

```yaml
rollback:
  failureThreshold: 2
  requireVerificationSuccess: true
```

**Percentage-based rollback:**

```yaml
rollback:
  minimumSuccessPercentage: 80
  requireVerificationSuccess: true
```

**Combined (either condition triggers rollback):**

```yaml
rollback:
  minimumSuccessPercentage: 80
  failureThreshold: 3
  requireVerificationSuccess: true
```

---

## Evaluation Logic

### Deployment Status Categories

For each release target, we look at the **latest job** for the version and categorize it:

| Status          | Condition                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Success**     | Job status is successful AND (no verifications OR all verifications passed)                                                             |
| **Failure**     | Job status is a terminal failure (`failure`, `invalidIntegration`, `invalidJobAgent`) OR verification status is `failed` or `cancelled` |
| **In-Progress** | Job status is `pending`/`inProgress` OR verification status is `running`                                                                |

> **Important:** Verifications in `running` state do NOT count as failures—they are treated as in-progress.

### Decision Steps

1. **Gather release targets** matching the policy selector
2. **For each target**, get the latest job for this version (if any)
3. **Categorize** each job as success/failure/in-progress
4. **Calculate counts**: `successCount`, `failureCount`, `inProgressCount`
5. **Check failure threshold** (if configured):
   - If `failureCount >= failureThreshold` → **DENY**
6. **Check success percentage** (if configured):
   - `totalCompleted = successCount + failureCount`
   - If `totalCompleted > 0` and `(successCount / totalCompleted * 100) < minimumSuccessPercentage` → **DENY**
7. **Otherwise** → **ALLOW**

### Edge Cases

| Scenario                                          | Behavior                             |
| ------------------------------------------------- | ------------------------------------ |
| No jobs for version on any matching target        | ALLOW (nothing to evaluate)          |
| All latest jobs are in-progress                   | ALLOW (no completed deployments yet) |
| Some in-progress, some failed, threshold not met  | ALLOW                                |
| Some in-progress, some failed, threshold exceeded | DENY                                 |

---

## Implementation Components

### 1. OpenAPI Schema Update

**File:** `apps/workspace-engine/oapi/spec/schemas/policy.jsonnet`

- Add `RollbackRule` schema (as shown above)
- Add `rollback` field to `PolicyRule`

### 2. Evaluator Implementation

**File:** `apps/workspace-engine/pkg/workspace/releasemanager/policy/evaluator/rollback/rollback.go`

- Implement `RollbackEvaluator` struct
- Implement `evaluator.Evaluator` interface:
  - `ScopeFields()` → `ScopeEnvironment | ScopeVersion`
  - `RuleType()` → `"rollback"`
  - `RuleId()` → rule ID from policy
  - `Complexity()` → `5` (higher due to cross-target queries)
  - `Evaluate(ctx, scope)` → decision logic

### 3. Policy Manager Integration

**File:** `apps/workspace-engine/pkg/workspace/releasemanager/policy/policymanager.go`

Add rollback evaluator **last** in `PlannerPolicyEvaluators()`:

```go
func (m *Manager) PlannerPolicyEvaluators(rule *oapi.PolicyRule) []evaluator.Evaluator {
    return evaluator.CollectEvaluators(
        // Existing evaluators...
        approval.NewEvaluator(m.store, rule),
        environmentprogression.NewEvaluator(m.store, rule),
        // ... other evaluators ...

        // Rollback evaluator LAST
        rollback.NewEvaluator(m.store, rule),
    )
}
```

### 4. Rule Type Constant

**File:** `apps/workspace-engine/pkg/workspace/releasemanager/policy/evaluator/evaulator.go`

Add `RuleTypeRollback = "rollback"` constant.

### 5. Store Helpers

**File:** `apps/workspace-engine/pkg/workspace/store/jobs.go`

Add helpers for querying jobs:

- `GetJobsForVersion(versionId string) []*Job` - All jobs for a version across targets
- `GetLatestJobForVersionOnTarget(versionId, releaseTargetKey string) *Job` - Latest job for version on specific target

### 6. Reactive Re-evaluation Hooks

**File:** `apps/workspace-engine/pkg/workspace/releasemanager/action/orchestrator.go`

- Add `triggerRollbackReEvaluation()` method
- Call it from `OnJobStatusChange()` when job fails

**File:** `apps/workspace-engine/pkg/workspace/releasemanager/verification_hooks.go`

- Add `triggerRollbackReEvaluation()` method
- Call it from `OnVerificationComplete()` when verification fails

---

## Reactive Re-evaluation

### The Problem

The current hooks only invalidate the cache for the **specific release target** where the job/verification changed. But rollback evaluation is **cross-target**—when one target fails, the aggregated failure count changes for ALL targets matching the policy.

**Example:**

- Targets A, B, C, D, E match policy with `failureThreshold: 2`
- Target A fails → only A's cache invalidated
- Target B fails → only B's cache invalidated
- Targets C, D, E still have stale evaluation (they don't know failure count is now 2)

### The Solution

When a job fails or verification fails, we need to **re-evaluate all sibling targets** that share the same rollback policy.

### Implementation: Extend Existing Hooks

**1. Action Orchestrator (`orchestrator.go`)**

On job failure, trigger re-evaluation for sibling targets:

```go
// In OnJobStatusChange, after existing action execution:
if job.Status == oapi.JobStatusFailure {
    o.triggerRollbackReEvaluation(ctx, job)
}

func (o *Orchestrator) triggerRollbackReEvaluation(ctx context.Context, job *oapi.Job) {
    // 1. Get the release for this job
    // 2. Find policies with rollback rules that match this release target
    // 3. For each policy, get all other release targets matching the selector
    // 4. For each sibling target with the same version deployed, invalidate cache / trigger reconciliation
}
```

**2. Verification Hooks (`verification_hooks.go`)**

On verification failure, trigger re-evaluation for sibling targets:

```go
func (h *releasemanagerVerificationHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error {
    // Existing: invalidate cache for this target
    h.invalidateCacheForVerification(verification)

    // NEW: If verification failed, trigger sibling re-evaluation
    if verification.Status() == oapi.JobVerificationStatusFailed {
        h.triggerRollbackReEvaluation(ctx, verification)
    }
    return nil
}
```

### Re-evaluation Flow

```
Job/Verification Fails on Target A (version X)
    │
    ▼
Find policies with rollback rules matching Target A
    │
    ▼
For each policy:
    │
    ├─► Get all release targets matching policy selector
    │
    └─► For each sibling target (B, C, D, E...):
            │
            ├─► Check if version X is deployed/being evaluated
            │
            └─► Invalidate cache OR trigger reconciliation
```

### What Gets Triggered

When a failure is detected:

1. **Cache invalidation** - The sibling targets' cached `ReleaseTargetState` is invalidated
2. **Next reconciliation** - When the planner next runs for those targets, the rollback evaluator will re-compute with updated failure counts
3. **Optional: Immediate reconciliation** - Could trigger `ReconcileTarget()` for urgent rollback (future enhancement)

---

## File Changes Summary

| File                                                                      | Change                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `oapi/spec/schemas/policy.jsonnet`                                        | Add `RollbackRule` schema, add `rollback` to `PolicyRule`    |
| `pkg/workspace/releasemanager/policy/evaluator/evaulator.go`              | Add `RuleTypeRollback` constant                              |
| `pkg/workspace/releasemanager/policy/evaluator/rollback/rollback.go`      | **NEW** - Evaluator implementation                           |
| `pkg/workspace/releasemanager/policy/evaluator/rollback/rollback_test.go` | **NEW** - Unit tests                                         |
| `pkg/workspace/releasemanager/policy/policymanager.go`                    | Add rollback to `PlannerPolicyEvaluators`                    |
| `pkg/workspace/releasemanager/action/orchestrator.go`                     | Add `triggerRollbackReEvaluation` on job failure             |
| `pkg/workspace/releasemanager/verification_hooks.go`                      | Add `triggerRollbackReEvaluation` on verification failure    |
| `pkg/workspace/store/jobs.go`                                             | Add helper methods (get jobs for version, latest per target) |

---

## Testing Scenarios

### Unit Tests

1. No jobs for version → ALLOW
2. All latest jobs successful, verifications passed → ALLOW
3. All latest jobs successful, verifications running → ALLOW (in-progress)
4. Failure threshold exceeded → DENY
5. Success percentage below minimum → DENY
6. Mixed: some in-progress, some failed, threshold not exceeded → ALLOW
7. Mixed: some in-progress, some failed, threshold exceeded → DENY
8. Verification failure counts toward failure threshold → DENY
9. Multiple jobs per target, only latest considered

### Integration Tests

1. **Gradual rollout with failures**
   - Deploy v1.2.3 to 3/100 targets, 2 fail
   - Rollback rule: `failureThreshold: 2`
   - Result: v1.2.3 blocked, planner picks v1.2.2

2. **Verification-triggered rollback**
   - Job succeeds, verification fails
   - Rollback evaluator denies version on next reconciliation

3. **Reactive re-evaluation (cross-target)**
   - Targets A, B, C all have v1.2.3 deployed successfully
   - Target D deploys v1.2.3, job fails
   - Rollback rule: `failureThreshold: 1`
   - Result: Targets A, B, C should be re-evaluated and rollback to v1.2.2

---

## Implementation Order

1. **Schema** - Add `RollbackRule` to OpenAPI spec, regenerate types
2. **Store helpers** - Add job query methods (`GetJobsForVersion`, `GetLatestJobForVersionOnTarget`)
3. **Evaluator** - Implement `rollback/rollback.go` with unit tests
4. **Policy Manager** - Add rollback evaluator to `PlannerPolicyEvaluators`
5. **Reactive hooks** - Extend `orchestrator.go` and `verification_hooks.go` for cross-target re-evaluation
6. **E2E tests** - Test full rollback flow including reactive re-evaluation

---

## Example Scenario Walkthrough

**Setup:**

- Policy selector: `environment.name == "production"`
- Rollback rule: `failureThreshold: 2, requireVerificationSuccess: true`
- 10 release targets in production
- Gradual rollout deploying version v1.2.3

**Flow:**

1. Target A: job succeeds, verification passes → **success**
2. Target B: job succeeds, verification running → **in-progress**
3. Target C: job succeeds, verification fails → **failure #1**
   - Verification hook fires
   - `triggerRollbackReEvaluation()` invalidates cache for targets A, B (siblings in same policy)
4. Target D: job fails → **failure #2**
   - Orchestrator detects job failure
   - `triggerRollbackReEvaluation()` invalidates cache for targets A, B, C (siblings)
5. Target E: planning begins...
   - Rollback evaluator runs for v1.2.3
   - Latest jobs: A=success, B=in-progress, C=failure, D=failure
   - `failureCount (2) >= failureThreshold (2)` → **DENY**
   - Planner picks v1.2.2 instead
6. Targets A, B, C also re-evaluate (cache already invalidated by reactive hooks)
   - v1.2.3 denied everywhere → planner picks v1.2.2
   - Target A: redeploys v1.2.2
   - Target B: cancels in-progress v1.2.3, deploys v1.2.2
   - Target C: redeploys v1.2.2

---

## Open Questions / Future Enhancements

1. **Time window** - `evaluationWindowMinutes` to only consider recent jobs?
2. **Minimum sample size** - `minimumDeployments` before rollback kicks in?
3. **Rollback cooldown** - Prevent rapid rollback/redeploy cycles?
