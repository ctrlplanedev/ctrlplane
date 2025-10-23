# Release Manager Architecture

## Overview

The Release Manager uses a **three-phase deployment pattern** to separate concerns:

1. **Planning** - Determine WHAT should be deployed
2. **Eligibility** - Determine IF a job should be created
3. **Execution** - Create and dispatch the job

## Three-Phase Design

### Phase 1: Planning (Planner)

**File**: `deployment/planner.go`

**Responsibility**: Determines the desired release based on version status and user-defined policies.

**What it does**:

- Filters candidate versions by status (only "ready" when policies exist)
- Selects which version should be deployed based on user policies
- Resolves deployment variables

**Returns**: `*oapi.Release` (the desired release) or `nil` (no deployable version)

**Key Point**: Version status checking happens directly in the planner during version selection - it's a planning concern, not a job creation concern.

---

### Phase 2: Job Eligibility (JobEligibilityChecker)

**File**: `deployment/job_eligibility.go`

**Responsibility**: Determines if a job should be created for the desired release.

**What it checks**:

- **Duplicate prevention**: Has this exact release already been attempted?
- **Retry logic**: Has the retry limit been exceeded? (future)

**Returns**: `bool` (should create job) + `*oapi.DeployDecision` (evaluation details)

**Key Point**: This is purely about job creation decisions for a specific release, not about version selection. Version status checking belongs in Phase 1 (planning).

---

### Phase 3: Execution (Executor)

**File**: `deployment/executor.go`

**Responsibility**: Creates the job and dispatches it to the integration.

**What it does**:

- Persists the release
- Cancels outdated jobs (for different releases on same target)
- Creates new job
- Dispatches job to integration

**Key Point**: This phase trusts that planning and eligibility phases have validated everything.

---

## Key Distinction: Policies vs Eligibility

### User-Defined Policies (Policy Manager)

**What**: Rules configured by users about deployment approval and sequencing
**Examples**:

- Approval requirements
- Environment progression (must deploy to staging before prod)
- Time-based deployment windows

**Location**: `policy/policymanager.go`

### Job Eligibility (JobEligibilityChecker)

**What**: Release-level rules about when to create jobs
**Examples**:

- Don't create duplicate jobs for the same release
- Retry limits (allow up to 4 retries for failed releases)

**Location**: `deployment/job_eligibility.go`

**Note**: Version status checks are NOT here - they belong in the Planner during version selection, as they're about which version to deploy, not whether to create a job.

---

## Reconciliation Flow

```
reconcileTarget(releaseTarget)
  │
  ├─ Phase 1: PLANNING
  │    └─ planner.PlanDeployment(releaseTarget)
  │         ├─ Get candidate versions
  │         ├─ Filter by version status (only "ready" if policies exist)
  │         ├─ Select version passing user policies (approval, etc.)
  │         └─ Returns: desiredRelease or nil
  │
  ├─ Phase 2: ELIGIBILITY
  │    └─ jobEligibilityChecker.ShouldCreateJob(desiredRelease)
  │         ├─ Check for duplicate releases
  │         ├─ Check retry limits (future)
  │         └─ Returns: true/false (should create job?)
  │
  └─ Phase 3: EXECUTION
       └─ executor.ExecuteRelease(desiredRelease)
            └─ Creates job and dispatches it
```

## Benefits of This Architecture

1. **Separation of Concerns**: Planning (what), eligibility (when), execution (how)
2. **Clear Naming**: No confusion between user policies and system job creation rules
3. **Extensibility**: Easy to add retry logic, failure limits, etc. in JobEligibilityChecker
4. **Testability**: Each phase can be tested independently
5. **Clarity**: The flow is explicit - planning → eligibility → execution

## Future Enhancements

### Retry Logic (in JobEligibilityChecker)

Add a `RetryLimitEvaluator` that tracks failed jobs and allows retries up to a limit:

```go
// In job_eligibility.go:
releaseEvaluators: []evaluator.ReleaseScopedEvaluator{
    skipdeployed.NewSkipDeployedEvaluator(store),
    retrylimit.NewRetryLimitEvaluator(store, maxRetries: 4),
},
```

This would:

- Count failed jobs for a release
- Allow retry if failures < 4
- Deny if failures >= 4

### Version Status Filtering

Consider moving version status checking earlier in the pipeline (during version selection) rather than in eligibility checking.
