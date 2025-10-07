# Release Manager Design

## Overview

The Release Manager orchestrates deployment decisions and execution. It follows a **Two-Phase Deployment Decision** pattern that clearly separates "what should be deployed?" from "make it happen".

## Core Design Pattern: Two-Phase Deployment Decision

```js
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: DECISION (Evaluate)                                │
│                                                             │
│ Question: "What needs to be deployed?"                      │
│ Nature:   READ-ONLY - examines state without modifying      │
│ Returns:  *pb.Release OR nil                                │
│                                                             │
│ Returns nil when:                                           │
│  • No versions available                                    │
│  • All versions blocked by policies                         │
│  • Already deployed (most recent successful job)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   if release != nil
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: ACTION (executeDeployment)                         │
│                                                             │
│ Question: "Make it happen"                                  │
│ Nature:   WRITES - persists release, creates jobs           │
│ Input:    Release from Evaluate() that NEEDS deploying      │
│                                                             │
│ No "should we deploy" checks here - trust Phase 1           │
└─────────────────────────────────────────────────────────────┘
```

### Why This Pattern?

**Before (problematic):**

```go
release := Evaluate()           // Returns v2.0.0
if alreadyDeployed(release) {   // Check AGAIN in execution
    return  // Confused: why did Evaluate() return it?
}
deploy(release)
```

**After (clean):**

```go
release := Evaluate()  // Returns nil if already deployed
if release == nil {
    return  // Nothing to deploy
}
deploy(release)  // If we got here, it NEEDS deploying
```

### Benefits

1. **Clear Separation of Concerns**: Decision logic separate from execution logic
2. **Single Source of Truth**: All "should we deploy" logic in one place
3. **Testability**: Can test decision logic without side effects
4. **Maintainability**: Know exactly where to add new decision criteria
5. **Trust Contract**: Execution phase trusts decision phase completely

## Architecture: Manager Responsibilities

The Release Manager coordinates three specialized managers:

```
┌──────────────────────────────────────────────────────────┐
│                    Release Manager                       │
│                    (Orchestrator)                        │
│                                                          │
│  Evaluate()                                              │
│  ├─→ Version Manager: Get candidate versions            │
│  ├─→ Policy Manager: Check if versions deployable       │
│  ├─→ Variable Manager: Resolve configuration            │
│  └─→ Check if already deployed                          │
│                                                          │
│  ProcessReleaseTarget()                                  │
│  ├─→ Evaluate() [decision]                              │
│  └─→ executeDeployment() [action]                       │
└──────────────────────────────────────────────────────────┘
         │                │                 │
         ↓                ↓                 ↓
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│   Version   │  │   Policy    │  │   Variable   │
│   Manager   │  │   Manager   │  │   Manager    │
└─────────────┘  └─────────────┘  └──────────────┘
```

### Version Manager

**Responsibility**: Provide candidate versions, sorted newest to oldest

**What it does:**

- Fetches versions for a deployment
- Sorts by creation time (newest first)
- Limits to top N candidates (performance optimization)

**What it does NOT do:**

- ❌ Check policies (that's Policy Manager's job)
- ❌ Decide which version to deploy (that's Release Manager's job)

```go
func (m *Manager) GetCandidateVersions(
    ctx context.Context,
    releaseTarget *pb.ReleaseTarget,
) []*pb.DeploymentVersion
```

### Policy Manager

**Responsibility**: Evaluate if a version + target combination can be deployed

**Policy Scopes**: Policies can be version-independent or version-dependent

#### Version-Independent Policies

Checked BEFORE fetching versions (optimization):

- **Time windows**: "No deployments Friday 3pm-5pm"
- **Concurrency limits**: "Max 5 running jobs per deployment"
- **Environment capacity**: "Only 1 deployment at a time in production"
- **Circuit breakers**: "System-wide deployment freeze"

#### Version-Dependent Policies

Checked FOR EACH candidate version:

- **Approvals**: "This version needs 2 approvals"
- **Age requirements**: "Version must be 24 hours old"
- **Security scans**: "This version must pass security scan"
- **Test requirements**: "Version must have passing tests"

```go
func (m *Manager) Evaluate(
    ctx context.Context,
    version *pb.DeploymentVersion,
    releaseTarget *pb.ReleaseTarget,
) (*DeployDecision, error)
```

**Why Policy Manager gets BOTH version AND target:**
This enables policies at any scope:

- Version scope (check version properties)
- Deployment scope (check deployment state)
- Environment scope (check environment capacity)
- Resource scope (check resource health)
- Time scope (check current time)
- Global scope (check system-wide state)

### Variable Manager

**Responsibility**: Resolve configuration variables for a deployment

**What it does:**

- Evaluates variable values based on release target context
- Handles inheritance and overrides
- Returns resolved key-value pairs

```go
func (m *Manager) Evaluate(
    ctx context.Context,
    releaseTarget *pb.ReleaseTarget,
) (map[string]*pb.VariableValue, error)
```

## Decision Tree: Where Does Logic Go?

### "Where do I put this check?"

Follow this decision tree:

```
Does it determine IF deployment is needed?
│
├─ YES → Put in Evaluate()
│   │
│   └─ Examples:
│       • No versions available
│       • Version blocked by policy
│       • Already deployed
│       • Time window restriction
│       • Concurrency limit reached
│
└─ NO → Is it about executing the deployment?
    │
    ├─ YES → Put in executeDeployment()
    │   │
    │   └─ Examples:
    │       • Persisting release
    │       • Creating job
    │       • Canceling outdated jobs
    │       • Dispatching to integration
    │
    └─ NO → Is it about a specific concern?
        │
        └─ Put in specialized manager
            • Version selection → VersionManager
            • Policy evaluation → PolicyManager
            • Variable resolution → VariableManager
```

### Examples

#### ✅ Good: Already Deployed Check in Evaluate()

```go
func (m *Manager) Evaluate(...) (*pb.Release, error) {
    // ... select version, resolve variables ...

    // Check if already deployed
    if m.isAlreadyDeployed(ctx, desiredRelease) {
        return nil, nil  // Nothing to deploy
    }

    return desiredRelease, nil
}
```

**Why?** It determines IF deployment is needed → Phase 1 (DECISION)

#### ❌ Bad: Already Deployed Check in executeDeployment()

```go
func (m *Manager) executeDeployment(...) error {
    if m.isAlreadyDeployed(ctx, release) {
        return nil  // Why did Evaluate() return it then?
    }
    // ... deploy ...
}
```

**Why bad?** executeDeployment() should trust Evaluate()'s decision

#### ✅ Good: Job Creation in executeDeployment()

```go
func (m *Manager) executeDeployment(...) error {
    m.store.Releases.Upsert(ctx, release)  // WRITE
    job := m.NewJob(ctx, release)
    m.store.Jobs.Upsert(ctx, job)          // WRITE
}
```

**Why?** It's executing the deployment plan → Phase 2 (ACTION)

## Common Patterns

### Pattern 1: Early Return in Evaluate()

```go
func (m *Manager) Evaluate(...) (*pb.Release, error) {
    // Check 1: Versions available?
    versions := m.versionManager.GetCandidateVersions(...)
    if len(versions) == 0 {
        return nil, nil  // Early return: nothing to deploy
    }

    // Check 2: Any version passes policies?
    version := m.selectDeployableVersion(...)
    if version == nil {
        return nil, nil  // Early return: all blocked
    }

    // Check 3: Already deployed?
    if m.isAlreadyDeployed(...) {
        return nil, nil  // Early return: already deployed
    }

    return release, nil  // Needs deploying!
}
```

**Pattern**: Multiple exit points for different "no deployment needed" reasons

### Pattern 2: Trust and Execute

```go
func (m *Manager) ProcessReleaseTarget(...) error {
    // DECISION
    release := m.Evaluate(...)
    if release == nil {
        return nil  // Trust the decision
    }

    // ACTION
    return m.executeDeployment(release)  // No second-guessing
}
```

**Pattern**: Simple trust-based flow

### Pattern 3: Orchestration

```go
func (m *Manager) Evaluate(...) (*pb.Release, error) {
    // Orchestrate specialized managers
    versions := m.versionManager.GetCandidateVersions(...)

    for _, version := range versions {
        decision, _ := m.policyManager.Evaluate(version, target)
        if decision.CanDeploy() {
            // Found a deployable version!
            variables, _ := m.variableManager.Evaluate(target)
            return m.buildRelease(version, variables, target), nil
        }
    }

    return nil, nil  // No deployable version
}
```

**Pattern**: Coordinate multiple managers to make a decision

## Idempotency

The system is idempotent:

```
State: v1.0.0 deployed

Reconcile() → v1.0.0 is latest
   ↓
Evaluate() → returns nil (already deployed)
   ↓
ProcessReleaseTarget() → does nothing

Result: v1.0.0 still deployed (no duplicate jobs)
```

Key checks for idempotency:

1. **Already deployed check**: Most recent successful job is for this release
2. **Job reconciliation**: Cancel outdated jobs, keep current job
3. **Duplicate detection**: Only one job per release

## Performance Optimizations

### 1. Limited Candidate Versions

```go
const MaxCandidateVersions = 100
```

Only evaluate latest 100 versions, not millions. Rationale: If latest 100 versions all fail policies, you have a bigger problem.

### 2. Early Termination

```go
for _, version := range candidates {
    if policyPasses(version) {
        return version  // Stop at first passing version
    }
}
```

Don't evaluate all versions if we find one that works.

### 3. Read-Only Decision Phase

All expensive checks (DB queries, etc.) happen in the read-only phase. Write phase is fast and simple.

## Testing Strategy

### Test Evaluate() (Decision Phase)

```go
func TestEvaluate_AlreadyDeployed_ReturnsNil(t *testing.T) {
    // Setup: Most recent job is for v1.0.0
    store := setupStoreWithDeployedVersion("v1.0.0")
    manager := NewManager(store)

    // Act: v1.0.0 is still latest
    release, err := manager.Evaluate(ctx, releaseTarget)

    // Assert: Should return nil (already deployed)
    assert.Nil(t, release)
}
```

### Test executeDeployment() (Action Phase)

```go
func TestExecuteDeployment_CreatesJob(t *testing.T) {
    // Setup: Release that needs deploying
    release := &pb.Release{...}
    manager := NewManager(store)

    // Act: Execute deployment
    err := manager.executeDeployment(ctx, release, span)

    // Assert: Job created and persisted
    assert.NoError(t, err)
    assert.Equal(t, 1, store.Jobs.Count())
}
```

## Adding New Decision Criteria

**Question**: "We need to check if resource is under maintenance before deploying"

**Answer**: Add to Evaluate() (Phase 1: DECISION)

```go
func (m *Manager) Evaluate(...) (*pb.Release, error) {
    // ... existing checks ...

    // New check: Resource maintenance
    resource, _ := m.store.Resources.Get(releaseTarget.ResourceId)
    if resource.UnderMaintenance {
        span.SetAttributes(attribute.String("skip_reason", "resource_under_maintenance"))
        return nil, nil
    }

    return desiredRelease, nil
}
```

## Adding New Execution Steps

**Question**: "We need to notify Slack before creating a job"

**Answer**: Add to executeDeployment() (Phase 2: ACTION)

```go
func (m *Manager) executeDeployment(...) error {
    m.store.Releases.Upsert(ctx, release)

    // New step: Notify Slack
    m.notifySlack(release)

    job := m.NewJob(ctx, release)
    m.store.Jobs.Upsert(ctx, job)
    go m.IntegrationDispatch(ctx, job)

    return nil
}
```

## Summary

### Key Principles

1. **Two-Phase Pattern**: Decision (read) then Action (write)
2. **Trust Contract**: If Evaluate() returns release, deploy it
3. **Single Responsibility**: Each manager has one concern
4. **Policy Flexibility**: Policies can check any scope (version, deployment, environment, etc.)
5. **Idempotency**: Safe to run multiple times
6. **Performance**: Early termination and limited candidates

### Mental Model

Think of it like a flight checklist:

**Pre-flight (Evaluate)**:

- ✓ Check fuel level
- ✓ Check weather
- ✓ Check runway available
- ✓ Get clearance

→ **Decision**: Can we take off? (Yes/No)

**Takeoff (executeDeployment)**:

- Start engines
- Release brakes
- Take off

→ **No additional checks**: Trust pre-flight

Same pattern for deployments:

- **Evaluate()**: Check everything, decide if deployment possible
- **executeDeployment()**: Trust the decision, execute the plan

This makes the code predictable, maintainable, and easy to reason about.
